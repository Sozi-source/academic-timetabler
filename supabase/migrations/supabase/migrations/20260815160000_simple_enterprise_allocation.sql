-- Simple enterprise allocation workflow

alter table public.trainers
  add column if not exists workload_role text not null default 'full_time_trainer',
  add column if not exists home_department text,
  add column if not exists normal_weekly_hours numeric(5,2) not null default 20,
  add column if not exists availability_mode text not null default 'generally_available';

alter table public.trainers drop constraint if exists trainers_workload_role_check;
alter table public.trainers add constraint trainers_workload_role_check
  check (workload_role in ('hod','course_coordinator','full_time_trainer','part_time','external'));
alter table public.trainers drop constraint if exists trainers_availability_mode_check;
alter table public.trainers add constraint trainers_availability_mode_check
  check (availability_mode in ('generally_available','selected_slots_only'));

-- Normalize existing rows before enforcing the new relationship. Some
-- part-time trainers can legitimately have a maximum below the 20-hour
-- full-time default introduced above.
update public.trainers set
  workload_role = case
    when employment_type = 'part_time' then 'part_time'
    when employment_type in ('visiting','contract') then 'external'
    else workload_role end,
  availability_mode = case when employment_type in ('part_time','visiting','contract')
    then 'selected_slots_only' else availability_mode end,
  normal_weekly_hours = least(normal_weekly_hours, maximum_weekly_hours);

alter table public.trainers drop constraint if exists trainers_normal_workload_check;
alter table public.trainers add constraint trainers_normal_workload_check
  check (normal_weekly_hours > 0 and normal_weekly_hours <= maximum_weekly_hours);

alter table public.units
  add column if not exists owning_department text,
  add column if not exists is_service_unit boolean not null default false;

alter table public.unit_offerings
  add column if not exists allocation_status text not null default 'unallocated',
  add column if not exists fixed_working_day_id uuid references public.working_days(id) on delete restrict,
  add column if not exists fixed_time_slot_id uuid references public.time_slots(id) on delete restrict,
  add column if not exists fixed_schedule_required boolean not null default false;

alter table public.unit_offerings drop constraint if exists unit_offerings_allocation_status_check;
alter table public.unit_offerings add constraint unit_offerings_allocation_status_check
  check (allocation_status in ('unallocated','allocated'));
alter table public.unit_offerings drop constraint if exists unit_offerings_fixed_schedule_check;
alter table public.unit_offerings add constraint unit_offerings_fixed_schedule_check
  check (not fixed_schedule_required or (fixed_working_day_id is not null and fixed_time_slot_id is not null));

create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  working_day_id uuid not null references public.working_days(id) on delete cascade,
  time_slot_id uuid not null references public.time_slots(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (trainer_id, academic_period_id, working_day_id, time_slot_id)
);

create table if not exists public.trainer_unit_eligibility (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (trainer_id, unit_id)
);

alter table public.trainer_availability enable row level security;
alter table public.trainer_unit_eligibility enable row level security;
grant select, insert, update, delete on public.trainer_availability, public.trainer_unit_eligibility to authenticated;

create policy "Authorized staff manage trainer availability" on public.trainer_availability
  for all to authenticated using ((select public.current_user_has_role(array['hod','system_admin']::public.app_role[])))
  with check ((select public.current_user_has_role(array['hod','system_admin']::public.app_role[])));
create policy "Authorized staff manage trainer eligibility" on public.trainer_unit_eligibility
  for all to authenticated using ((select public.current_user_has_role(array['hod','system_admin']::public.app_role[])))
  with check ((select public.current_user_has_role(array['hod','system_admin']::public.app_role[])));

create or replace function public.generate_current_unit_offerings(p_academic_period_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
  insert into public.unit_offerings
    (academic_period_id, cohort_id, unit_id, offering_type, status, is_timetable_enabled,
     weekly_sessions, session_duration_minutes, source, origin, selection_state,
     recommended_stage_number)
  select p_academic_period_id, c.id, u.id,
    case when coalesce(u.practical_hours,0) > coalesce(u.theory_hours,0)
      then 'practical'::public.unit_offering_type else 'classroom'::public.unit_offering_type end,
    'draft'::public.unit_offering_status, true, u.weekly_sessions, 120,
    'active_cohort_curriculum', 'curriculum', 'included', c.current_academic_period_number
  from public.cohorts c
  join public.units u on u.programme_id = c.programme_id
    and u.academic_period_number = c.current_academic_period_number
  where c.status = 'active' and c.is_timetable_available
    and u.is_active and u.is_timetable_available
  on conflict (academic_period_id, cohort_id, unit_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end $$;

create or replace function public.assign_unit_offering(p_offering_id uuid, p_trainer_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare o public.unit_offerings%rowtype; t public.trainers%rowtype;
  used_hours numeric; added_hours numeric; projected numeric; allocation_id uuid;
begin
  select * into o from public.unit_offerings where id=p_offering_id for update;
  if o.id is null then raise exception 'Unit on offer was not found'; end if;
  if o.allocation_status='allocated' then raise exception 'This unit on offer is already allocated'; end if;
  if o.fixed_schedule_required and (o.fixed_working_day_id is null or o.fixed_time_slot_id is null)
    then raise exception 'Set the fixed day and time before allocating this unit'; end if;
  select * into t from public.trainers where id=p_trainer_id;
  if t.id is null or not t.is_active or not t.is_timetable_available then
    raise exception 'The selected trainer is not available for timetabling'; end if;
  if exists(select 1 from public.trainer_unit_eligibility e where e.unit_id=o.unit_id)
    and not exists(select 1 from public.trainer_unit_eligibility e where e.unit_id=o.unit_id and e.trainer_id=p_trainer_id)
    then raise exception 'The selected trainer is not approved to teach this unit'; end if;
  if t.availability_mode='selected_slots_only' and not exists(
    select 1 from public.trainer_availability a where a.trainer_id=t.id
      and a.academic_period_id=o.academic_period_id
      and (not o.fixed_schedule_required or (a.working_day_id=o.fixed_working_day_id and a.time_slot_id=o.fixed_time_slot_id)))
    then raise exception 'Add an available teaching time for this trainer first'; end if;
  select coalesce(sum(weekly_sessions*session_duration_minutes)/60.0,0) into used_hours
    from public.teaching_allocations where trainer_id=t.id and academic_period_id=o.academic_period_id
    and status in ('draft','active');
  added_hours := coalesce(o.weekly_sessions,1)*coalesce(o.session_duration_minutes,120)/60.0;
  projected := used_hours+added_hours;
  if projected > t.maximum_weekly_hours then
    raise exception 'Maximum workload exceeded: %h projected, %h maximum', projected, t.maximum_weekly_hours;
  end if;
  insert into public.teaching_allocations
    (academic_period_id,cohort_id,unit_id,trainer_id,delivery_mode,weekly_sessions,
     session_duration_minutes,status,is_timetable_enabled,notes)
  values (o.academic_period_id,o.cohort_id,o.unit_id,t.id,
    case when o.offering_type='practical' then 'practical'::public.teaching_delivery_mode else 'theory'::public.teaching_delivery_mode end,
    coalesce(o.weekly_sessions,1),coalesce(o.session_duration_minutes,120),'active',true,
    case when o.fixed_schedule_required then 'Fixed schedule configured on unit offering' else null end)
  returning id into allocation_id;
  update public.unit_offerings set allocation_status='allocated',status='active',updated_at=now() where id=o.id;
  return jsonb_build_object('allocationId',allocation_id,'allocatedHours',projected,
    'normalHours',t.normal_weekly_hours,'maximumHours',t.maximum_weekly_hours,
    'isExtraLoad',projected>t.normal_weekly_hours);
end $$;

grant execute on function public.generate_current_unit_offerings(uuid) to authenticated;
grant execute on function public.assign_unit_offering(uuid,uuid) to authenticated;

comment on function public.assign_unit_offering(uuid,uuid) is
  'Atomically assigns one unit offering, blocks duplicates, validates eligibility/availability and enforces the trainer hard workload limit.';
