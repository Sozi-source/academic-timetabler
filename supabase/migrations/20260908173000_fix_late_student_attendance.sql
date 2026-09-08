begin;

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
  expected_isodow integer;
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
    scheduled.status::text
      as schedule_status,
    working_day.day_of_week::text
      as day_of_week,
    start_slot.starts_at,
    end_slot.ends_at,
    period.teaching_starts_on,
    period.teaching_ends_on
  into schedule_row
  from public.scheduled_sessions
    as scheduled
  join public.working_days
    as working_day
    on working_day.id =
      scheduled.working_day_id
  join public.time_slots
    as start_slot
    on start_slot.id =
      scheduled.start_time_slot_id
  join public.time_slots
    as end_slot
    on end_slot.id =
      scheduled.end_time_slot_id
  join public.academic_periods
    as period
    on period.id =
      scheduled.academic_period_id
  where scheduled.id =
    target_scheduled_session_id;

  if not found then
    raise exception
      'Published timetable session was not found.'
      using errcode = 'P0002';
  end if;

  if schedule_row.schedule_status <>
    'locked'
  then
    raise exception
      'Attendance can only be opened from a published timetable session.'
      using errcode = '23514';
  end if;

  if not public.trainer_can_access_allocation(
    schedule_row.teaching_allocation_id
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if target_session_date <
      schedule_row.teaching_starts_on
     or target_session_date >
      schedule_row.teaching_ends_on
  then
    raise exception
      'Class date must fall within the academic period teaching dates.'
      using errcode = '23514';
  end if;

  expected_isodow =
    case
      schedule_row.day_of_week
      when 'monday'
        then 1
      when 'tuesday'
        then 2
      when 'wednesday'
        then 3
      when 'thursday'
        then 4
      when 'friday'
        then 5
      when 'saturday'
        then 6
      when 'sunday'
        then 7
      else null
    end;

  if expected_isodow is null
     or extract(
       isodow
       from target_session_date
     )::integer <>
       expected_isodow
  then
    raise exception
      'The selected date does not match the published timetable day.'
      using errcode = '23514';
  end if;

  participant_cohorts =
    case
      when coalesce(
        cardinality(
          schedule_row.participant_cohort_ids
        ),
        0
      ) > 0
      then schedule_row.participant_cohort_ids
      else array[
        schedule_row.cohort_id
      ]
    end;

  select
    session.id
  into existing_session_id
  from public.class_sessions
    as session
  where session.scheduled_session_id =
      target_scheduled_session_id
    and session.session_date =
      target_session_date
    and session.status <>
      'cancelled'
  limit 1;

  if existing_session_id is not null then
    return existing_session_id;
  end if;

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
    schedule_row.starts_at,
    schedule_row.ends_at,
    schedule_row.room_id,
    'open',
    auth.uid()
  )
  returning id
  into new_session_id;

  insert into public.class_attendance_entries (
    class_session_id,
    student_id,
    cohort_id,
    attendance_status
  )
  select distinct
    new_session_id,
    registration.student_id,
    registration.cohort_id,
    'unmarked'
  from public.student_unit_registrations
    as registration
  where registration.academic_period_id =
      schedule_row.academic_period_id
    and registration.cohort_id =
      any(
        participant_cohorts
      )
    and registration.unit_id =
      schedule_row.unit_id
    and registration.registration_status::text =
      'registered'
    and registration.registered_at::date <= target_session_date
  order by
    registration.student_id;

  get diagnostics roster_total =
    row_count;

  if roster_total = 0 then
    raise exception
      'No registered students were found for this unit and participating cohort(s).'
      using errcode = 'P0002';
  end if;

  update public.class_sessions
  set
    roster_count =
      roster_total,
    updated_at =
      now()
  where id =
    new_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    to_status,
    actor_id
  )
  values (
    new_session_id,
    'session_opened',
    'open',
    auth.uid()
  );

  return new_session_id;
end;
$$;

commit;
