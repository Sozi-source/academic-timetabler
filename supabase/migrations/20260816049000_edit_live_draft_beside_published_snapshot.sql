-- Published timetable versions are immutable snapshots, not locks on the
-- department's live working draft. A confirmed allocation change may cancel
-- its live sessions while the current published snapshot remains unchanged.

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
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before changing allocations';
  end if;

  if p_allocation_id is null then
    raise exception using
      errcode = '22023',
      message = 'Select a teaching allocation before unassigning its trainer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'unassign-teaching-allocation:' || p_allocation_id::text,
    0
  ));

  select allocation_row.*
  into allocation
  from public.teaching_allocations allocation_row
  join public.cohorts cohort on cohort.id = allocation_row.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation_row.id = p_allocation_id
    and programme.department_id = active_department
  for update of allocation_row;

  if allocation.id is null then
    raise exception
      'The teaching allocation was not found in the working department';
  end if;

  if allocation.status not in ('draft', 'active', 'suspended') then
    raise exception 'This teaching allocation has already been closed';
  end if;

  -- Locked working sessions may be cancelled by this explicit HOD action.
  -- No timetable_versions row or snapshot is updated by this function.
  update public.scheduled_sessions session
  set
    status = 'cancelled',
    conflict_state = 'clear',
    is_locked = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(session.notes), ''),
      'Cancelled because the trainer allocation was removed from the live draft.'
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
      'Trainer unassigned from the live draft; allocation archived for audit.'
    ), 1500),
    updated_at = now(),
    updated_by = auth.uid()
  where id = allocation.id;

  if allocation.teaching_offering_id is not null then
    select offering.*
    into shared_offering
    from public.teaching_offerings offering
    where offering.id = allocation.teaching_offering_id
      and offering.department_id = active_department
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
    'shared', shared_offering.id is not null,
    'publishedSnapshotPreserved', true
  );
end;
$$;

revoke all on function public.unassign_teaching_allocation(uuid)
from public;
grant execute on function public.unassign_teaching_allocation(uuid)
to authenticated;

comment on function public.unassign_teaching_allocation(uuid) is
  'Archives a live teaching allocation and cancels its working sessions without changing any immutable published timetable snapshot.';
