-- Migration: Allow draft edits while timetable is published
-- Redefine apply_same_department_trainer_exchange to allow live draft exchanges
-- without unpublishing or archiving active timetable versions.

create or replace function public.apply_same_department_trainer_exchange(
  target_allocation_id uuid,
  partner_allocation_id uuid,
  allow_protected_reopen boolean default false
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
  reopened_version_count integer := 0;
  archived_published_version_count integer := 0;
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

  -- Verify locked sessions check is only executed if not allow_protected_reopen
  if not allow_protected_reopen and exists (
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

  -- Reopened loops and version status checking are bypassed to allow background draft modification.

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
      'partnerProjectedHours', partner_projected_hours,
      'reopenedVersionCount', reopened_version_count,
      'archivedPublishedVersionCount', archived_published_version_count
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
    'partnerProjectedHours', partner_projected_hours,
    'reopenedVersionCount', reopened_version_count,
    'archivedPublishedVersionCount', archived_published_version_count
  );
end;
$$;

revoke all on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) from public;
grant execute on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) to authenticated;

comment on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) is
  'Exchanges equal-duration same-department trainer allocations in the live draft without affecting published snapshot versions.';


-- Overwrite create_timetable_version to include participantCohortIds in the version snapshot JSONB
create or replace function public.create_timetable_version(
  target_academic_period_id uuid,
  version_title text,
  version_change_summary text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  next_version integer;
  version_id uuid;
  sessions_total integer;
  blocked_total integer;
  version_snapshot jsonb;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before publishing.';
  end if;
  if nullif(trim(version_title), '') is null then
    raise exception using errcode = '22023',
      message = 'A timetable version title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-version:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  select count(*), count(*) filter (where session.conflict_state = 'blocked')
  into sessions_total, blocked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  if sessions_total = 0 then
    raise exception using errcode = 'P0001',
      message = 'No draft timetable sessions are available to version.';
  end if;
  if blocked_total > 0 then
    raise exception using errcode = 'P0001',
      message = 'Resolve all blocking timetable conflicts before creating a version.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'cohortId', session.cohort_id,
    'cohortName', cohort.name,
    'unitId', session.unit_id,
    'unitCode', unit_record.code,
    'unitName', unit_record.name,
    'trainerId', session.trainer_id,
    'trainerName', coalesce(trainer.full_name, 'UNASSIGNED'),
    'roomId', session.room_id,
    'roomCode', room.code,
    'roomName', room.name,
    'workingDayId', session.working_day_id,
    'day', working_day.day_of_week,
    'daySequence', working_day.sequence_number,
    'startTimeSlotId', session.start_time_slot_id,
    'startTime', start_slot.starts_at,
    'endTimeSlotId', session.end_time_slot_id,
    'endTime', end_slot.ends_at,
    'sessionNumber', session.session_number,
    'deliveryMode', session.delivery_mode,
    'isLocked', session.is_locked,
    'notes', session.notes,
    'participantCohortIds', to_jsonb(session.participant_cohort_ids)
  ) order by working_day.sequence_number, start_slot.sequence_number,
    cohort.name, unit_record.code), '[]'::jsonb)
  into version_snapshot
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  join public.units unit_record on unit_record.id = session.unit_id
  left join public.trainers trainer on trainer.id = session.trainer_id
  left join public.rooms room on room.id = session.room_id
  join public.working_days working_day on working_day.id = session.working_day_id
  join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
  join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.timetable_versions
  where department_id = active_department
    and academic_period_id = target_academic_period_id;

  insert into public.timetable_versions (
    department_id, academic_period_id, version_number, status, title,
    change_summary, session_count, conflict_count, snapshot, created_by
  ) values (
    active_department, target_academic_period_id, next_version, 'draft',
    trim(version_title), nullif(trim(version_change_summary), ''),
    sessions_total, blocked_total, version_snapshot, auth.uid()
  ) returning id into version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (
    version_id, 'created', null, 'draft',
    nullif(trim(version_change_summary), ''), auth.uid()
  );

  return version_id;
end;
$$;

revoke all on function public.create_timetable_version(uuid, text, text) from public;
grant execute on function public.create_timetable_version(uuid, text, text) to authenticated;

comment on function public.create_timetable_version(uuid, text, text) is
  'Creates a new timetable version with snapshot including participantCohortIds.';


-- Redefine get_institution_trainer_workloads as plpgsql to bypass RLS via security definer and prevent SQL inlining
create or replace function public.get_institution_trainer_workloads(
  target_academic_period_id uuid
)
returns table (
  trainer_id uuid,
  allocated_hours numeric,
  department_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  with active_allocations as (
    select allocation.*
    from public.teaching_allocations allocation
    join public.unit_offerings source_offering
      on source_offering.id = allocation.source_unit_offering_id
    where allocation.academic_period_id = target_academic_period_id
      and allocation.trainer_id is not null
      and allocation.status in ('draft', 'active')
      and source_offering.approval_status = 'approved'
      and source_offering.selection_state = 'included'
      and source_offering.is_timetable_enabled
  ), deliveries as (
    select allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id) as delivery_id,
      max(allocation.weekly_sessions * allocation.session_duration_minutes) as weekly_minutes
    from active_allocations allocation
    group by allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id)
  ), trainer_hours as (
    select delivery.trainer_id,
      coalesce(sum(delivery.weekly_minutes) / 60.0, 0)::numeric as allocated_hours
    from deliveries delivery
    group by delivery.trainer_id
  ), trainer_departments as (
    select allocation.trainer_id,
      count(distinct programme.department_id) as department_count
    from active_allocations allocation
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    group by allocation.trainer_id
  )
  select hours.trainer_id, hours.allocated_hours, departments.department_count
  from trainer_hours hours
  join trainer_departments departments on departments.trainer_id = hours.trainer_id;
end;
$$;

revoke all on function public.get_institution_trainer_workloads(uuid) from public;
grant execute on function public.get_institution_trainer_workloads(uuid) to authenticated;

comment on function public.get_institution_trainer_workloads(uuid) is
  'Aggregates institution-wide trainer workloads by unique delivery, counting shared-class participant rows once.';
