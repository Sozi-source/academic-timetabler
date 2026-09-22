-- Allocation register support and reversible, audited trainer unassignment.
-- Archived allocations remain available for audit, while a partial unique
-- index permits the same unit offering to be allocated again.

drop index if exists public.teaching_allocations_period_cohort_unit_unique_idx;

create unique index teaching_allocations_period_cohort_unit_unique_idx
on public.teaching_allocations (
  academic_period_id,
  cohort_id,
  unit_id
)
where status in ('draft', 'active', 'suspended');

create or replace function public.unassign_teaching_allocation(
  p_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  allocation public.teaching_allocations%rowtype;
  shared_offering public.teaching_offerings%rowtype;
  affected_offering_count integer := 0;
  cancelled_session_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before changing allocations';
  end if;

  select allocation_row.*
  into allocation
  from public.teaching_allocations allocation_row
  join public.cohorts cohort on cohort.id = allocation_row.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation_row.id = p_allocation_id
    and programme.department_id = active_department
  for update of allocation_row;

  if allocation.id is null then
    raise exception 'The teaching allocation was not found in the working department';
  end if;

  if allocation.status not in ('draft', 'active', 'suspended') then
    raise exception 'This teaching allocation has already been closed';
  end if;

  if exists (
    select 1
    from public.scheduled_sessions session
    where session.teaching_allocation_id = allocation.id
      and (
        session.is_locked = true
        or session.status = 'locked'
      )
  ) then
    raise exception
      'Unlock this allocation''s timetable sessions before unassigning the trainer';
  end if;

  if exists (
    select 1
    from public.timetable_versions version
    cross join lateral jsonb_array_elements(version.snapshot) snapshot_session
    join public.scheduled_sessions session
      on snapshot_session ->> 'id' = session.id::text
    where version.department_id = active_department
      and version.academic_period_id = allocation.academic_period_id
      and version.status in ('under_review', 'approved', 'published')
      and session.teaching_allocation_id = allocation.id
  ) then
    raise exception
      'This allocation is part of a timetable under review, approved or published. Reopen that timetable before unassigning';
  end if;

  update public.scheduled_sessions session
  set
    status = 'cancelled',
    conflict_state = 'clear',
    is_locked = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(session.notes), ''),
      'Cancelled because the trainer allocation was removed.'
    ), 1000),
    updated_at = now(),
    updated_by = auth.uid()
  where session.teaching_allocation_id = allocation.id
    and session.status not in ('cancelled', 'archived');

  get diagnostics cancelled_session_count = row_count;

  update public.teaching_allocations
  set
    status = 'archived',
    is_timetable_enabled = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(notes), ''),
      'Trainer unassigned; allocation archived for audit.'
    ), 1500),
    updated_at = now(),
    updated_by = auth.uid()
  where id = allocation.id;

  if allocation.teaching_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = allocation.teaching_offering_id
      and department_id = active_department
    for update;

    if shared_offering.id is null then
      raise exception 'The shared teaching offering could not be found';
    end if;

    update public.teaching_offerings
    set
      trainer_id = null,
      status = 'draft',
      updated_at = now(),
      updated_by = auth.uid()
    where id = shared_offering.id;

    update public.unit_offerings
    set
      allocation_status = 'unallocated',
      is_provisionally_reserved = false,
      status = 'draft',
      updated_at = now(),
      updated_by = auth.uid()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set
      allocation_status = 'unallocated',
      is_provisionally_reserved = false,
      status = 'draft',
      updated_at = now(),
      updated_by = auth.uid()
    where academic_period_id = allocation.academic_period_id
      and cohort_id = allocation.cohort_id
      and unit_id = allocation.unit_id;
  end if;

  get diagnostics affected_offering_count = row_count;

  return jsonb_build_object(
    'allocationId', allocation.id,
    'trainerId', allocation.trainer_id,
    'affectedOfferingCount', affected_offering_count,
    'cancelledSessionCount', cancelled_session_count,
    'shared', shared_offering.id is not null
  );
end;
$$;

revoke all
on function public.unassign_teaching_allocation(uuid)
from public;

grant execute
on function public.unassign_teaching_allocation(uuid)
to authenticated;

comment on function public.unassign_teaching_allocation(uuid) is
  'Archives an allocation, cancels editable draft sessions, and returns its unit offering or shared class to the trainer allocation queue.';
