-- Migration: 20260912193000_strict_unit_registration_roster.sql
-- Description: Enforce that class attendance, CAT attendance, exam attendance,
-- and daily report absentees reference strictly verified unit registrations
-- (student_unit_registrations), and never add unregistered students merely
-- because their cohort shares a timetable session.

-- 1. Upgrade open_class_attendance_session to seed ONLY registered students
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
  participant_cohorts uuid[];
  existing_session_id uuid;
  new_session_id uuid;
  roster_total integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if target_session_date is null then
    raise exception
      'Class date is required.'
      using errcode = '22023';
  end if;

  select
    scheduled.id,
    scheduled.academic_period_id,
    scheduled.teaching_allocation_id,
    scheduled.cohort_id,
    scheduled.participant_cohort_ids,
    scheduled.unit_id,
    scheduled.trainer_id,
    scheduled.room_id,
    scheduled.status::text as schedule_status,
    working_day.day_of_week::text as day_of_week,
    start_slot.starts_at,
    end_slot.ends_at,
    period.teaching_starts_on,
    period.teaching_ends_on
  into schedule_row
  from public.scheduled_sessions as scheduled
  left join public.working_days as working_day
    on working_day.id = scheduled.working_day_id
  left join public.time_slots as start_slot
    on start_slot.id = scheduled.start_time_slot_id
  left join public.time_slots as end_slot
    on end_slot.id = scheduled.end_time_slot_id
  left join public.academic_periods as period
    on period.id = scheduled.academic_period_id
  where scheduled.id = target_scheduled_session_id;

  if not found then
    raise exception
      'Published timetable session was not found.'
      using errcode = 'P0002';
  end if;

  -- Lock session if not already locked
  if schedule_row.schedule_status <> 'locked' then
    update public.scheduled_sessions
    set status = 'locked', is_locked = true, updated_at = now()
    where id = target_scheduled_session_id;
  end if;

  if not public.trainer_can_access_allocation(
    schedule_row.teaching_allocation_id
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  -- Check existing active session
  select session.id
  into existing_session_id
  from public.class_sessions as session
  where session.scheduled_session_id = target_scheduled_session_id
    and session.session_date = target_session_date
    and session.status <> 'cancelled'
  limit 1;

  if existing_session_id is not null then
    -- Ensure all registered students for this unit are seeded into existing session
    insert into public.class_attendance_entries (
      class_session_id,
      student_id,
      cohort_id,
      attendance_status
    )
    select distinct
      existing_session_id,
      reg.student_id,
      coalesce(reg.cohort_id, schedule_row.cohort_id),
      case
        when spr.reporting_status = 'reported' then 'unmarked'
        else 'not_reported'
      end
    from public.student_unit_registrations as reg
    left join public.student_period_reporting spr
      on spr.student_id = reg.student_id
     and spr.academic_period_id = schedule_row.academic_period_id
    where reg.academic_period_id = schedule_row.academic_period_id
      and reg.unit_id = schedule_row.unit_id
      and reg.registration_status::text = 'registered'
    on conflict (class_session_id, student_id) do nothing;

    -- Purge any entries for students who are NOT registered for this unit & period
    delete from public.class_attendance_entries cae
    where cae.class_session_id = existing_session_id
      and not exists (
        select 1
        from public.student_unit_registrations reg
        where reg.academic_period_id = schedule_row.academic_period_id
          and reg.unit_id = schedule_row.unit_id
          and reg.registration_status::text = 'registered'
          and reg.student_id = cae.student_id
      );

    select count(*)
    into roster_total
    from public.class_attendance_entries
    where class_session_id = existing_session_id;

    update public.class_sessions
    set roster_count = roster_total, updated_at = now()
    where id = existing_session_id;

    return existing_session_id;
  end if;

  -- Create new class session
  insert into public.class_sessions (
    academic_period_id,
    teaching_allocation_id,
    scheduled_session_id,
    cohort_id,
    unit_id,
    trainer_id,
    session_date,
    starts_at,
    ends_at,
    room_id,
    status,
    opened_by
  )
  values (
    schedule_row.academic_period_id,
    schedule_row.teaching_allocation_id,
    schedule_row.id,
    schedule_row.cohort_id,
    schedule_row.unit_id,
    schedule_row.trainer_id,
    target_session_date,
    coalesce(schedule_row.starts_at, '08:00:00'::time),
    coalesce(schedule_row.ends_at, '10:00:00'::time),
    schedule_row.room_id,
    'open',
    auth.uid()
  )
  returning id into new_session_id;

  -- Insert registered students for this unit
  insert into public.class_attendance_entries (
    class_session_id,
    student_id,
    cohort_id,
    attendance_status
  )
  select distinct
    new_session_id,
    reg.student_id,
    coalesce(reg.cohort_id, schedule_row.cohort_id),
    case
      when spr.reporting_status = 'reported' then 'unmarked'
      else 'not_reported'
    end
  from public.student_unit_registrations as reg
  left join public.student_period_reporting spr
    on spr.student_id = reg.student_id
   and spr.academic_period_id = schedule_row.academic_period_id
  where reg.academic_period_id = schedule_row.academic_period_id
    and reg.unit_id = schedule_row.unit_id
    and reg.registration_status::text = 'registered'
  on conflict (class_session_id, student_id) do nothing;

  select count(*)
  into roster_total
  from public.class_attendance_entries
  where class_session_id = new_session_id;

  update public.class_sessions
  set
    roster_count = roster_total,
    updated_at = now()
  where id = new_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    created_by,
    event_payload
  )
  values (
    new_session_id,
    'session_opened',
    auth.uid(),
    jsonb_build_object(
      'session_date', target_session_date,
      'roster_count', roster_total,
      'scheduled_session_id', target_scheduled_session_id
    )
  );

  return new_session_id;
end;
$$;

-- 2. One-time cleanup: Remove all orphaned entries for students not registered for the unit/period
delete from public.class_attendance_entries cae
using public.class_sessions cs
where cae.class_session_id = cs.id
  and not exists (
    select 1
    from public.student_unit_registrations reg
    where reg.academic_period_id = cs.academic_period_id
      and reg.unit_id = cs.unit_id
      and reg.registration_status::text = 'registered'
      and reg.student_id = cae.student_id
  );

-- 3. Synchronize roster_count on all class_sessions
update public.class_sessions cs
set roster_count = (
  select count(*)::integer
  from public.class_attendance_entries cae
  where cae.class_session_id = cs.id
),
updated_at = now();
