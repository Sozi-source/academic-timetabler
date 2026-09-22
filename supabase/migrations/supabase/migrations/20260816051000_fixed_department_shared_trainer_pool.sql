-- Keep each departmental login anchored to its primary department while
-- sharing trainer capacity and timetable occupancy across the institution.

update public.profiles profile
set
  active_department_id = membership.department_id,
  department_name = department.name
from public.department_memberships membership
join public.departments department
  on department.id = membership.department_id
where membership.profile_id = profile.id
  and membership.is_active = true
  and membership.is_primary = true
  and (
    profile.active_department_id is distinct from membership.department_id
    or profile.department_name is distinct from department.name
  );

create or replace function public.current_user_primary_department_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select membership.department_id
      from public.department_memberships membership
      where membership.profile_id = (select auth.uid())
        and membership.is_active = true
        and membership.is_primary = true
      order by membership.created_at, membership.id
      limit 1
    ),
    (
      select profile.active_department_id
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.is_active = true
    ),
    (
      select membership.department_id
      from public.department_memberships membership
      where membership.profile_id = (select auth.uid())
        and membership.is_active = true
      order by membership.created_at, membership.id
      limit 1
    )
  );
$$;

create or replace function public.set_active_workspace(
  p_department_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_department_id uuid := public.current_user_primary_department_id();
  primary_department_name text;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if primary_department_id is null then
    raise exception using
      errcode = '42501',
      message = 'No primary department is assigned to this account';
  end if;

  if p_department_id is distinct from primary_department_id then
    raise exception using
      errcode = '42501',
      message = 'This account is fixed to its primary department';
  end if;

  select department.name
  into primary_department_name
  from public.departments department
  where department.id = primary_department_id
    and department.is_active = true;

  if primary_department_name is null then
    raise exception using
      errcode = '42501',
      message = 'The assigned primary department is not active';
  end if;

  update public.profiles
  set
    active_department_id = primary_department_id,
    department_name = primary_department_name
  where id = (select auth.uid())
    and is_active = true;
end;
$$;

create or replace function public.get_institution_trainer_workloads(
  target_academic_period_id uuid
)
returns table (
  trainer_id uuid,
  allocated_hours numeric,
  department_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    allocation.trainer_id,
    coalesce(sum(
      allocation.weekly_sessions * allocation.session_duration_minutes
    ) / 60.0, 0)::numeric as allocated_hours,
    count(distinct programme.department_id) as department_count
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.academic_period_id = target_academic_period_id
    and allocation.trainer_id is not null
    and allocation.status in ('draft', 'active')
    and public.current_user_has_role(
      array['hod', 'system_admin']::public.app_role[]
    )
  group by allocation.trainer_id;
$$;

create or replace function public.get_institution_trainer_timetable_rows(
  target_academic_period_id uuid
)
returns table (
  session_id uuid,
  working_day_label text,
  day_sequence integer,
  starts_at time,
  ends_at time,
  cohort_id uuid,
  cohort_code text,
  cohort_name text,
  cohort_size integer,
  participant_cohorts jsonb,
  unit_code text,
  unit_name text,
  trainer_id uuid,
  trainer_name text,
  trainer_target_hours numeric,
  room_code text,
  room_name text,
  session_status text,
  is_locked boolean,
  department_code text,
  department_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    initcap(day.day_of_week::text),
    day.sequence_number,
    start_slot.starts_at,
    end_slot.ends_at,
    cohort.id,
    cohort.code,
    cohort.name,
    coalesce(session.combined_cohort_size, cohort.actual_size, 0),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', participant.id,
          'code', participant.code,
          'name', participant.name
        )
        order by participant.code
      )
      from public.cohorts participant
      where participant.id = any(
        array_append(
          coalesce(session.participant_cohort_ids, '{}'::uuid[]),
          session.cohort_id
        )
      )
    ), '[]'::jsonb),
    unit_record.code,
    unit_record.name,
    trainer.id,
    trainer.full_name,
    trainer.normal_weekly_hours,
    room.code,
    coalesce(room.name, 'No room assigned'),
    session.status::text,
    session.is_locked,
    department.code,
    department.name
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
    and public.current_user_has_role(
      array['hod', 'system_admin']::public.app_role[]
    )
  order by trainer.full_name, day.sequence_number, start_slot.starts_at;
$$;

create or replace function public.enforce_institution_trainer_maximum_workload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_minutes numeric;
  proposed_minutes numeric;
  maximum_minutes numeric;
begin
  if new.trainer_id is null or new.status not in ('draft', 'active') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-workload:' || new.trainer_id::text || ':'
      || new.academic_period_id::text,
    0
  ));

  select trainer.maximum_weekly_hours * 60
  into maximum_minutes
  from public.trainers trainer
  where trainer.id = new.trainer_id
    and trainer.is_active = true
    and trainer.is_timetable_available = true;

  if maximum_minutes is null then
    raise exception using
      errcode = '23503',
      message = 'The selected trainer is not available';
  end if;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ), 0)
  into used_minutes
  from public.teaching_allocations allocation
  where allocation.trainer_id = new.trainer_id
    and allocation.academic_period_id = new.academic_period_id
    and allocation.status in ('draft', 'active')
    and allocation.id is distinct from new.id;

  proposed_minutes := new.weekly_sessions * new.session_duration_minutes;

  if used_minutes + proposed_minutes > maximum_minutes then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Maximum institutional workload exceeded: %s hours projected, %s hours maximum',
        (used_minutes + proposed_minutes) / 60.0,
        maximum_minutes / 60.0
      );
  end if;

  return new;
end;
$$;

drop trigger if exists teaching_allocations_enforce_institution_workload
on public.teaching_allocations;

create trigger teaching_allocations_enforce_institution_workload
before insert or update of
  trainer_id,
  academic_period_id,
  weekly_sessions,
  session_duration_minutes,
  status
on public.teaching_allocations
for each row
execute function public.enforce_institution_trainer_maximum_workload();

create or replace function public.enforce_institution_trainer_session_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_start time;
  session_end time;
begin
  if new.trainer_id is null or new.status in ('cancelled', 'archived') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-session:' || new.trainer_id::text || ':'
      || new.academic_period_id::text || ':' || new.working_day_id::text,
    0
  ));

  select start_slot.starts_at, end_slot.ends_at
  into session_start, session_end
  from public.time_slots start_slot
  cross join public.time_slots end_slot
  where start_slot.id = new.start_time_slot_id
    and end_slot.id = new.end_time_slot_id;

  if session_start is null or session_end is null then
    return new;
  end if;

  if exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id is distinct from new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.trainer_id = new.trainer_id
      and existing.working_day_id = new.working_day_id
      and existing.status in ('draft', 'confirmed', 'locked')
      and session_start < existing_end.ends_at
      and existing_start.starts_at < session_end
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'The trainer is already scheduled at this time by another department';
  end if;

  return new;
end;
$$;

drop trigger if exists scheduled_sessions_enforce_institution_trainer_overlap
on public.scheduled_sessions;

create trigger scheduled_sessions_enforce_institution_trainer_overlap
before insert or update of
  academic_period_id,
  trainer_id,
  working_day_id,
  start_time_slot_id,
  end_time_slot_id,
  status
on public.scheduled_sessions
for each row
execute function public.enforce_institution_trainer_session_overlap();

revoke all on function public.get_institution_trainer_workloads(uuid)
from public;
grant execute on function public.get_institution_trainer_workloads(uuid)
to authenticated;

revoke all on function public.get_institution_trainer_timetable_rows(uuid)
from public;
grant execute on function public.get_institution_trainer_timetable_rows(uuid)
to authenticated;

revoke all on function public.enforce_institution_trainer_maximum_workload()
from public;
revoke all on function public.enforce_institution_trainer_session_overlap()
from public;

comment on function public.get_institution_trainer_workloads(uuid) is
  'Returns each trainer total allocation hours across all departments in one Academic Period.';

comment on function public.get_institution_trainer_timetable_rows(uuid) is
  'Returns assigned trainer timetable rows across all departments for complete personal schedules.';
