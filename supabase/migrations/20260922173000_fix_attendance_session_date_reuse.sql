-- Fix attendance session reuse across different class dates.
-- Read-only diagnosis confirmed that Milkah Wambui's 22-Sep sessions were
-- resolving to completed 15-Sep/17-Sep class_sessions solely because the same
-- scheduled_session_id already had a historical attendance record.
--
-- The scheduled-session match MUST also match target_session_date. Historical
-- attendance remains intact; opening a new date creates a new class_session.

create or replace function public.open_class_attendance_session(
  target_scheduled_session_id uuid,
  target_session_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  schedule_row record;
  existing_session_id uuid;
  new_session_id uuid;
  roster_total integer;
  related_unit_ids uuid[];
  resolved_session_id uuid := target_scheduled_session_id;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if target_session_date is null then
    raise exception 'Class date is required.' using errcode = '22023';
  end if;

  select
    scheduled.id, scheduled.academic_period_id, scheduled.teaching_allocation_id,
    scheduled.cohort_id, scheduled.participant_cohort_ids, scheduled.unit_id,
    scheduled.trainer_id, scheduled.room_id, scheduled.status::text as schedule_status,
    working_day.day_of_week::text as day_of_week, start_slot.starts_at, end_slot.ends_at,
    period.teaching_starts_on, period.teaching_ends_on
  into schedule_row
  from public.scheduled_sessions scheduled
  left join public.working_days working_day on working_day.id = scheduled.working_day_id
  left join public.time_slots start_slot on start_slot.id = scheduled.start_time_slot_id
  left join public.time_slots end_slot on end_slot.id = scheduled.end_time_slot_id
  left join public.academic_periods period on period.id = scheduled.academic_period_id
  where scheduled.id = target_scheduled_session_id;

  if schedule_row.id is null then
    select
      (item ->> 'id')::uuid as id, version.academic_period_id,
      coalesce(nullif(item ->> 'teachingAllocationId', '')::uuid, ta.id) as teaching_allocation_id,
      (item ->> 'cohortId')::uuid as cohort_id,
      case when jsonb_typeof(item -> 'participantCohortIds') = 'array' then
        (select array_agg(value::text::uuid) from jsonb_array_elements_text(item -> 'participantCohortIds'))
      else array[(item ->> 'cohortId')::uuid] end as participant_cohort_ids,
      (item ->> 'unitId')::uuid as unit_id,
      coalesce(nullif(item ->> 'trainerId', '')::uuid, ta.trainer_id) as trainer_id,
      nullif(item ->> 'roomId', '')::uuid as room_id, 'locked' as schedule_status,
      (item ->> 'day')::text as day_of_week,
      coalesce(nullif(item ->> 'startTime', '')::time, '08:00:00'::time) as starts_at,
      coalesce(nullif(item ->> 'endTime', '')::time, '10:00:00'::time) as ends_at,
      period.teaching_starts_on, period.teaching_ends_on
    into schedule_row
    from public.timetable_versions version
    join public.academic_periods period on period.id = version.academic_period_id
    cross join lateral jsonb_array_elements(version.snapshot) item
    left join public.teaching_allocations ta
      on ta.academic_period_id = version.academic_period_id
     and ta.unit_id = (item ->> 'unitId')::uuid
     and ta.cohort_id = (item ->> 'cohortId')::uuid
    where version.status = 'published'
      and item ->> 'id' = target_scheduled_session_id::text
    order by version.version_number desc
    limit 1;
  end if;

  if schedule_row.id is null then
    raise exception 'Published timetable session was not found.' using errcode = 'P0002';
  end if;

  if schedule_row.schedule_status <> 'locked'
     and exists (select 1 from public.scheduled_sessions where id = target_scheduled_session_id) then
    update public.scheduled_sessions
    set status = 'locked', is_locked = true, updated_at = now()
    where id = target_scheduled_session_id;
  end if;

  if schedule_row.trainer_id is distinct from public.current_trainer_id()
     and not public.trainer_can_access_allocation(schedule_row.teaching_allocation_id)
     and not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'This class is outside your Teaching Allocations.' using errcode = '42501';
  end if;

  with shared_offering as (
    select ta.teaching_offering_id as shared_id
    from public.teaching_allocations ta
    where ta.id = schedule_row.teaching_allocation_id
      and ta.teaching_offering_id is not null
    union
    select uo.confirmed_shared_offering_id as shared_id
    from public.unit_offerings uo
    where uo.academic_period_id = schedule_row.academic_period_id
      and uo.unit_id = schedule_row.unit_id
      and uo.confirmed_shared_offering_id is not null
  ),
  discovered_units as (
    select schedule_row.unit_id as unit_id
    union
    select uo.unit_id
    from public.unit_offerings uo
    join shared_offering so on so.shared_id = uo.confirmed_shared_offering_id
    where uo.academic_period_id = schedule_row.academic_period_id
    union
    select u2.id as unit_id
    from public.units u1
    join public.units u2 on lower(trim(u1.name)) = lower(trim(u2.name))
    join public.unit_offerings uo on uo.unit_id = u2.id
     and uo.academic_period_id = schedule_row.academic_period_id
     and uo.cohort_id = any(array_cat(
       case when schedule_row.cohort_id is not null then array[schedule_row.cohort_id] else array[]::uuid[] end,
       coalesce(schedule_row.participant_cohort_ids, array[]::uuid[])
     ))
    where u1.id = schedule_row.unit_id
  )
  select array_agg(distinct unit_id) into related_unit_ids from discovered_units;

  if related_unit_ids is null or array_length(related_unit_ids, 1) = 0 then
    related_unit_ids := array[schedule_row.unit_id];
  end if;

  -- CRITICAL FIX: scheduled_session_id alone is not sufficient because a
  -- scheduled session can have legitimate attendance records on many dates.
  select session.id
  into existing_session_id
  from public.class_sessions session
  where (
    (session.scheduled_session_id = target_scheduled_session_id
     and session.session_date = target_session_date)
    or
    (session.teaching_allocation_id = schedule_row.teaching_allocation_id
     and session.session_date = target_session_date
     and session.starts_at = schedule_row.starts_at)
  )
  and session.status <> 'cancelled'
  order by
    (case when session.scheduled_session_id = target_scheduled_session_id then 0 else 1 end),
    session.updated_at desc
  limit 1;

  if existing_session_id is not null then
    update public.class_sessions
    set scheduled_session_id = target_scheduled_session_id, updated_at = now()
    where id = existing_session_id
      and (scheduled_session_id is null or scheduled_session_id <> target_scheduled_session_id);

    insert into public.class_attendance_entries (class_session_id, student_id, cohort_id, attendance_status)
    select distinct existing_session_id, reg.student_id,
      coalesce(reg.cohort_id, schedule_row.cohort_id),
      case when spr.reporting_status = 'reported' then 'unmarked' else 'not_reported' end
    from public.student_unit_registrations reg
    left join public.student_period_reporting spr
      on spr.student_id = reg.student_id
     and spr.academic_period_id = schedule_row.academic_period_id
    where reg.academic_period_id = schedule_row.academic_period_id
      and reg.unit_id = any(related_unit_ids)
      and reg.registration_status::text = 'registered'
    on conflict (class_session_id, student_id) do nothing;

    return existing_session_id;
  end if;

  insert into public.class_sessions (
    academic_period_id, teaching_allocation_id, scheduled_session_id, cohort_id, unit_id,
    trainer_id, session_date, starts_at, ends_at, room_id, status, roster_count, opened_by, opened_at
  ) values (
    schedule_row.academic_period_id, schedule_row.teaching_allocation_id, target_scheduled_session_id,
    schedule_row.cohort_id, schedule_row.unit_id, coalesce(schedule_row.trainer_id, public.current_trainer_id()),
    target_session_date, schedule_row.starts_at, schedule_row.ends_at, schedule_row.room_id,
    'open', 0, auth.uid(), now()
  ) returning id into new_session_id;

  insert into public.class_attendance_entries (class_session_id, student_id, cohort_id, attendance_status)
  select distinct new_session_id, reg.student_id,
    coalesce(reg.cohort_id, schedule_row.cohort_id),
    case when spr.reporting_status = 'reported' then 'unmarked' else 'not_reported' end
  from public.student_unit_registrations reg
  left join public.student_period_reporting spr
    on spr.student_id = reg.student_id
   and spr.academic_period_id = schedule_row.academic_period_id
  where reg.academic_period_id = schedule_row.academic_period_id
    and reg.unit_id = any(related_unit_ids)
    and reg.registration_status::text = 'registered'
  on conflict (class_session_id, student_id) do nothing;

  select count(*) into roster_total
  from public.class_attendance_entries
  where class_session_id = new_session_id;

  update public.class_sessions set roster_count = roster_total where id = new_session_id;

  insert into public.class_attendance_events (class_session_id, event_type, from_status, to_status, note, created_by)
  values (new_session_id, 'opened', null, 'open',
    'Class attendance session opened with registered student roster.', auth.uid());

  return new_session_id;
end;
$$;

revoke all on function public.open_class_attendance_session(uuid, date) from public;
grant execute on function public.open_class_attendance_session(uuid, date) to authenticated;

comment on function public.open_class_attendance_session(uuid, date) is
  'Opens/reconnects attendance for the requested date only; historical attendance for the same scheduled session is never reused for another date.';
