create table public.manual_trainer_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  created_by_department_id uuid not null references public.departments(id) on delete restrict
    default public.current_user_primary_department_id(),
  unit_code text not null check (char_length(trim(unit_code)) between 1 and 50),
  unit_name text not null check (char_length(trim(unit_name)) between 1 and 200),
  cohort_label text not null check (char_length(trim(cohort_label)) between 1 and 200),
  source_department_code text,
  source_department_name text not null check (char_length(trim(source_department_name)) between 1 and 200),
  day_label text not null check (char_length(trim(day_label)) between 1 and 30),
  day_sequence integer not null check (day_sequence between 1 and 20),
  starts_at time not null,
  ends_at time not null,
  room_code text,
  room_name text not null default 'No room assigned',
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint manual_trainer_timetable_time_check check (starts_at < ends_at)
);

create index manual_trainer_timetable_period_trainer_idx
  on public.manual_trainer_timetable_entries (academic_period_id, trainer_id, day_sequence, starts_at);

alter table public.manual_trainer_timetable_entries enable row level security;
revoke all on public.manual_trainer_timetable_entries from anon;
grant select, insert, delete on public.manual_trainer_timetable_entries to authenticated;

create policy manual_trainer_entries_read on public.manual_trainer_timetable_entries
for select to authenticated using (
  public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
);
create policy manual_trainer_entries_insert on public.manual_trainer_timetable_entries
for insert to authenticated with check (
  created_by_department_id = public.current_user_primary_department_id()
  and public.current_user_can_manage_department(created_by_department_id)
);
create policy manual_trainer_entries_delete on public.manual_trainer_timetable_entries
for delete to authenticated using (
  public.current_user_has_role(array['system_admin']::public.app_role[])
  or (
    created_by_department_id = public.current_user_primary_department_id()
    and public.current_user_can_manage_department(created_by_department_id)
  )
);

create or replace function public.prevent_manual_trainer_timetable_overlap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-session:' || new.trainer_id::text || ':' || new.academic_period_id::text || ':' || lower(new.day_label), 0
  ));

  if exists (
    select 1 from public.manual_trainer_timetable_entries existing
    where existing.id is distinct from new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.trainer_id = new.trainer_id
      and lower(existing.day_label) = lower(new.day_label)
      and new.starts_at < existing.ends_at and existing.starts_at < new.ends_at
  ) or exists (
    select 1 from public.scheduled_sessions session
    join public.working_days day on day.id = session.working_day_id
    join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
    join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
    where session.academic_period_id = new.academic_period_id
      and session.trainer_id = new.trainer_id
      and lower(day.day_of_week::text) = lower(new.day_label)
      and session.status in ('draft', 'confirmed', 'locked')
      and new.starts_at < end_slot.ends_at and start_slot.starts_at < new.ends_at
  ) then
    raise exception using errcode = 'P0001', message = 'The trainer already has a session at this time';
  end if;
  return new;
end;
$$;

create trigger manual_trainer_timetable_prevent_overlap
before insert or update on public.manual_trainer_timetable_entries
for each row execute function public.prevent_manual_trainer_timetable_overlap();

create or replace function public.get_institution_trainer_timetable_rows(target_academic_period_id uuid)
returns table (
  session_id uuid, working_day_label text, day_sequence integer, starts_at time, ends_at time,
  cohort_id uuid, cohort_code text, cohort_name text, cohort_size integer, participant_cohorts jsonb,
  unit_code text, unit_name text, trainer_id uuid, trainer_name text, trainer_target_hours numeric,
  room_code text, room_name text, session_status text, is_locked boolean,
  department_code text, department_name text
)
language sql stable security definer set search_path = '' as $$
  select session.id, initcap(day.day_of_week::text), day.sequence_number,
    start_slot.starts_at, end_slot.ends_at, cohort.id, cohort.code, cohort.name,
    coalesce(session.combined_cohort_size, cohort.actual_size, 0),
    coalesce((select jsonb_agg(jsonb_build_object('id', participant.id, 'code', participant.code, 'name', participant.name) order by participant.code)
      from public.cohorts participant where participant.id = any(array_append(coalesce(session.participant_cohort_ids, '{}'::uuid[]), session.cohort_id))), '[]'::jsonb),
    unit_record.code, unit_record.name, trainer.id, trainer.full_name, trainer.normal_weekly_hours,
    room.code, coalesce(room.name, 'No room assigned'), session.status::text, session.is_locked,
    department.code, department.name
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  join public.departments department on department.id = programme.department_id
  join public.units unit_record on unit_record.id = session.unit_id
  join public.trainers trainer on trainer.id = session.trainer_id
  join public.working_days day on day.id = session.working_day_id
  join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
  join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
  left join public.rooms room on room.id = session.room_id
  where session.academic_period_id = target_academic_period_id
    and session.status in ('draft', 'confirmed', 'locked')
    and public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  union all
  select entry.id, entry.day_label, entry.day_sequence, entry.starts_at, entry.ends_at,
    entry.id, entry.cohort_label, entry.cohort_label, 0,
    jsonb_build_array(jsonb_build_object('id', entry.id, 'code', entry.cohort_label, 'name', entry.cohort_label)),
    entry.unit_code, entry.unit_name, trainer.id, trainer.full_name, trainer.normal_weekly_hours,
    entry.room_code, entry.room_name, 'manual', false,
    entry.source_department_code, entry.source_department_name
  from public.manual_trainer_timetable_entries entry
  join public.trainers trainer on trainer.id = entry.trainer_id
  where entry.academic_period_id = target_academic_period_id
    and public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  order by 14, 3, 4;
$$;

revoke all on function public.prevent_manual_trainer_timetable_overlap() from public;
revoke all on function public.get_institution_trainer_timetable_rows(uuid) from public;
grant execute on function public.get_institution_trainer_timetable_rows(uuid) to authenticated;
