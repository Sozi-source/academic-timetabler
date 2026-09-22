-- Smart repair may exchange trainers between two current-department
-- allocations when their session duration matches. The exchange is atomic,
-- audited and never touches another department's allocation.

create table if not exists public.timetable_trainer_exchange_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  target_allocation_id uuid references public.teaching_allocations(id) on delete set null,
  partner_allocation_id uuid references public.teaching_allocations(id) on delete set null,
  target_previous_trainer_id uuid references public.trainers(id) on delete set null,
  partner_previous_trainer_id uuid references public.trainers(id) on delete set null,
  duration_minutes integer not null check (duration_minutes > 0),
  cancelled_session_count integer not null default 0 check (cancelled_session_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now()
);

create index if not exists timetable_trainer_exchange_events_period_idx
on public.timetable_trainer_exchange_events (
  department_id,
  academic_period_id,
  applied_at desc
);

alter table public.timetable_trainer_exchange_events enable row level security;

drop policy if exists timetable_trainer_exchange_events_read
on public.timetable_trainer_exchange_events;

create policy timetable_trainer_exchange_events_read
on public.timetable_trainer_exchange_events
for select
to authenticated
using (
  public.current_user_can_access_department(department_id)
);

create or replace function public.apply_same_department_trainer_exchange(
  target_allocation_id uuid,
  partner_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  target_allocation public.teaching_allocations%rowtype;
  partner_allocation public.teaching_allocations%rowtype;
  target_trainer public.trainers%rowtype;
  partner_trainer public.trainers%rowtype;
  target_projected_hours numeric;
  partner_projected_hours numeric;
  cancelled_sessions integer := 0;
  exchange_event_id uuid;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before applying an exchange';
  end if;

  if target_allocation_id is null
    or partner_allocation_id is null
    or target_allocation_id = partner_allocation_id then
    raise exception using
      errcode = '22023',
      message = 'Select two different teaching allocations for the exchange';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-exchange:'
      || least(target_allocation_id::text, partner_allocation_id::text)
      || ':'
      || greatest(target_allocation_id::text, partner_allocation_id::text),
    0
  ));

  select allocation.*
  into target_allocation
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = target_allocation_id
    and programme.department_id = active_department
  for update of allocation;

  select allocation.*
  into partner_allocation
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = partner_allocation_id
    and programme.department_id = active_department
  for update of allocation;

  if target_allocation.id is null or partner_allocation.id is null then
    raise exception using
      errcode = '42501',
      message = 'Both exchange allocations must belong to the current working department';
  end if;

  if target_allocation.academic_period_id <> partner_allocation.academic_period_id then
    raise exception using
      errcode = '23514',
      message = 'Trainer exchanges must stay inside one Academic Period';
  end if;

  if target_allocation.status not in ('draft', 'active', 'suspended')
    or partner_allocation.status not in ('draft', 'active', 'suspended') then
    raise exception using
      errcode = '23514',
      message = 'Both teaching allocations must remain editable';
  end if;

  if target_allocation.trainer_id is null
    or partner_allocation.trainer_id is null
    or target_allocation.trainer_id = partner_allocation.trainer_id then
    raise exception using
      errcode = '23514',
      message = 'The exchange requires two different assigned trainers';
  end if;

  if target_allocation.session_duration_minutes
      <> partner_allocation.session_duration_minutes then
    raise exception using
      errcode = '23514',
      message = 'Only units with the same session duration may exchange trainers';
  end if;

  select trainer.* into target_trainer
  from public.trainers trainer
  where trainer.id = target_allocation.trainer_id
    and trainer.department_id = active_department
    and trainer.is_active
    and trainer.is_timetable_available;

  select trainer.* into partner_trainer
  from public.trainers trainer
  where trainer.id = partner_allocation.trainer_id
    and trainer.department_id = active_department
    and trainer.is_active
    and trainer.is_timetable_available;

  if target_trainer.id is null or partner_trainer.id is null then
    raise exception using
      errcode = '23514',
      message = 'Both trainers must be active, timetable-available members of the current department';
  end if;

  if exists (
    select 1
    from public.scheduled_sessions session
    where session.teaching_allocation_id in (
      target_allocation.id,
      partner_allocation.id
    )
      and (session.is_locked or session.status = 'locked')
  ) then
    raise exception using
      errcode = '55000',
      message = 'Unlock the affected timetable sessions before applying this exchange';
  end if;

  if exists (
    select 1
    from public.timetable_versions version
    cross join lateral jsonb_array_elements(version.snapshot) snapshot_session
    join public.scheduled_sessions session
      on snapshot_session ->> 'id' = session.id::text
    where version.department_id = active_department
      and version.academic_period_id = target_allocation.academic_period_id
      and version.status in ('under_review', 'approved', 'published')
      and session.teaching_allocation_id in (
        target_allocation.id,
        partner_allocation.id
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'Return the active timetable to an editable draft before applying this exchange';
  end if;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into target_projected_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = target_trainer.id
    and allocation.academic_period_id = target_allocation.academic_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and allocation.id not in (target_allocation.id, partner_allocation.id);

  target_projected_hours := target_projected_hours
    + partner_allocation.weekly_sessions
      * partner_allocation.session_duration_minutes / 60.0;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into partner_projected_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = partner_trainer.id
    and allocation.academic_period_id = target_allocation.academic_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and allocation.id not in (target_allocation.id, partner_allocation.id);

  partner_projected_hours := partner_projected_hours
    + target_allocation.weekly_sessions
      * target_allocation.session_duration_minutes / 60.0;

  if target_projected_hours > target_trainer.maximum_weekly_hours
    or partner_projected_hours > partner_trainer.maximum_weekly_hours then
    raise exception using
      errcode = '23514',
      message = 'The exchange would exceed a trainer''s absolute weekly maximum';
  end if;

  update public.scheduled_sessions session
  set
    status = 'cancelled',
    conflict_state = 'clear',
    is_locked = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(session.notes), ''),
      'Cancelled for an approved same-department trainer exchange.'
    ), 1000),
    updated_at = now(),
    updated_by = auth.uid()
  where session.teaching_allocation_id in (
    target_allocation.id,
    partner_allocation.id
  )
    and session.status not in ('cancelled', 'archived');

  get diagnostics cancelled_sessions = row_count;

  update public.teaching_allocations allocation
  set
    trainer_id = case
      when allocation.id = target_allocation.id
        then partner_trainer.id
      else target_trainer.id
    end,
    notes = left(concat_ws(
      ' ',
      nullif(trim(allocation.notes), ''),
      'Trainer exchanged automatically with an equal-duration allocation.'
    ), 1500),
    updated_at = now(),
    updated_by = auth.uid()
  where allocation.id in (
    target_allocation.id,
    partner_allocation.id
  );

  if target_allocation.teaching_offering_id is not null then
    update public.teaching_offerings
    set
      trainer_id = partner_trainer.id,
      updated_at = now(),
      updated_by = auth.uid()
    where id = target_allocation.teaching_offering_id
      and department_id = active_department;
  end if;

  if partner_allocation.teaching_offering_id is not null then
    update public.teaching_offerings
    set
      trainer_id = target_trainer.id,
      updated_at = now(),
      updated_by = auth.uid()
    where id = partner_allocation.teaching_offering_id
      and department_id = active_department;
  end if;

  insert into public.timetable_trainer_exchange_events (
    department_id,
    academic_period_id,
    target_allocation_id,
    partner_allocation_id,
    target_previous_trainer_id,
    partner_previous_trainer_id,
    duration_minutes,
    cancelled_session_count,
    summary,
    applied_by
  ) values (
    active_department,
    target_allocation.academic_period_id,
    target_allocation.id,
    partner_allocation.id,
    target_trainer.id,
    partner_trainer.id,
    target_allocation.session_duration_minutes,
    cancelled_sessions,
    jsonb_build_object(
      'targetTrainerName', target_trainer.full_name,
      'partnerTrainerName', partner_trainer.full_name,
      'targetProjectedHours', target_projected_hours,
      'partnerProjectedHours', partner_projected_hours
    ),
    auth.uid()
  ) returning id into exchange_event_id;

  return jsonb_build_object(
    'exchangeEventId', exchange_event_id,
    'targetAllocationId', target_allocation.id,
    'partnerAllocationId', partner_allocation.id,
    'targetTrainerId', partner_trainer.id,
    'partnerTrainerId', target_trainer.id,
    'cancelledSessionCount', cancelled_sessions,
    'targetProjectedHours', target_projected_hours,
    'partnerProjectedHours', partner_projected_hours
  );
end;
$$;

revoke all on table public.timetable_trainer_exchange_events from public;
grant select on table public.timetable_trainer_exchange_events to authenticated;

revoke all on function public.apply_same_department_trainer_exchange(uuid, uuid)
from public;
grant execute on function public.apply_same_department_trainer_exchange(uuid, uuid)
to authenticated;

comment on function public.apply_same_department_trainer_exchange(uuid, uuid) is
  'Atomically exchanges two active same-department trainers between equal-duration allocations, cancels editable placements for regeneration, and records the repair.';
