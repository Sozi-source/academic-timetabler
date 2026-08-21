begin;

-- ============================================================================
-- Class Attendance Oversight V20
--
-- Requires V19.1 Class Attendance.
--
-- Adds:
-- - shared-class participant cohort roster support
-- - department-scoped HOD/system-admin attendance access
-- - department attendance overview/detail RPCs
-- - controlled department-scoped reopen
--
-- Staff attendance remains Present / Absent only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Access helper.
--
-- Trainers may access their assigned class.
-- HOD/system-admin may access only sessions containing a cohort owned by their
-- currently active managed department.
-- ----------------------------------------------------------------------------

create or replace function public.current_user_can_access_class_attendance(
  target_scheduled_session_id uuid,
  target_teaching_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.trainer_can_access_allocation(
      target_teaching_allocation_id
    )
    or exists (
      select 1
      from public.scheduled_sessions
        as scheduled
      cross join lateral unnest(
        case
          when coalesce(
            cardinality(
              scheduled.participant_cohort_ids
            ),
            0
          ) > 0
          then scheduled.participant_cohort_ids
          else array[
            scheduled.cohort_id
          ]
        end
      ) as participant(
        cohort_id
      )
      join public.cohorts
        as cohort
        on cohort.id =
          participant.cohort_id
      join public.programmes
        as programme
        on programme.id =
          cohort.programme_id
      where scheduled.id =
          target_scheduled_session_id
        and public.current_user_can_manage_department(
          programme.department_id
        )
    );
$$;

revoke all
on function public.current_user_can_access_class_attendance(
  uuid,
  uuid
)
from public;

grant execute
on function public.current_user_can_access_class_attendance(
  uuid,
  uuid
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Replace broad V19 HOD policies with department-scoped access.
-- ----------------------------------------------------------------------------

drop policy if exists
  class_sessions_authorized_read
on public.class_sessions;

create policy class_sessions_authorized_read
on public.class_sessions
for select
to authenticated
using (
  public.current_user_can_access_class_attendance(
    scheduled_session_id,
    teaching_allocation_id
  )
);

drop policy if exists
  class_attendance_entries_authorized_read
on public.class_attendance_entries;

create policy class_attendance_entries_authorized_read
on public.class_attendance_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_entries.class_session_id
      and public.current_user_can_access_class_attendance(
        session.scheduled_session_id,
        session.teaching_allocation_id
      )
  )
);

drop policy if exists
  class_attendance_events_authorized_read
on public.class_attendance_events;

create policy class_attendance_events_authorized_read
on public.class_attendance_events
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_events.class_session_id
      and public.current_user_can_access_class_attendance(
        session.scheduled_session_id,
        session.teaching_allocation_id
      )
  )
);

-- ----------------------------------------------------------------------------
-- Shared-class-aware session opening.
--
-- V19 used the primary scheduled cohort only. V20 snapshots every registered
-- student from scheduled_sessions.participant_cohort_ids, with the primary
-- cohort as a fallback.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Secure the existing workspace RPC and improve shared cohort labelling.
--
-- Trainers see their full assigned class roster.
-- HOD/system-admin see only students belonging to the currently active managed
-- department.
-- ----------------------------------------------------------------------------

create or replace function public.get_class_attendance_workspace(
  target_class_session_id uuid
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  scheduled_session_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  student_id uuid,
  admission_number text,
  full_name text,
  attendance_status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
  trainer_access boolean;
begin
  select
    session.teaching_allocation_id,
    session.scheduled_session_id
  into session_row
  from public.class_sessions
    as session
  where session.id =
    target_class_session_id;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_access_class_attendance(
    session_row.scheduled_session_id,
    session_row.teaching_allocation_id
  ) then
    raise exception
      'This class is outside your permitted department or Teaching Allocations.'
      using errcode = '42501';
  end if;

  trainer_access =
    public.trainer_can_access_allocation(
      session_row.teaching_allocation_id
    );

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.scheduled_session_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    (
      select string_agg(
        distinct roster_cohort.name,
        ' / '
        order by roster_cohort.name
      )
      from public.class_attendance_entries
        as roster_entry
      join public.cohorts
        as roster_cohort
        on roster_cohort.id =
          roster_entry.cohort_id
      where roster_entry.class_session_id =
        session.id
    ),
    session.starts_at,
    session.ends_at,
    session.roster_count,
    student.id,
    student.admission_number,
    student.full_name,
    entry.attendance_status,
    entry.note
  from public.class_sessions
    as session
  join public.academic_periods
    as period
    on period.id =
      session.academic_period_id
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  join public.students
    as student
    on student.id =
      entry.student_id
  join public.cohorts
    as student_cohort
    on student_cohort.id =
      entry.cohort_id
  join public.programmes
    as programme
    on programme.id =
      student_cohort.programme_id
  where session.id =
      target_class_session_id
    and (
      trainer_access
      or public.current_user_can_manage_department(
        programme.department_id
      )
    )
  order by
    student.full_name,
    student.admission_number;
end;
$$;

-- ----------------------------------------------------------------------------
-- Department overview.
-- Counts are scoped to the caller's currently active managed department.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_class_attendance_overview(
  target_limit integer default 100
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_names text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  student_count integer,
  present_count integer,
  absent_count integer,
  unmarked_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
begin
  active_department =
    public.current_user_primary_department_id();

  if active_department is null
     or not public.current_user_can_manage_department(
       active_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    string_agg(
      distinct cohort.name,
      ' / '
      order by cohort.name
    ),
    trainer.full_name,
    session.starts_at,
    session.ends_at,
    count(entry.id)::integer,
    count(entry.id) filter (
      where entry.attendance_status =
        'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status =
        'absent'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status =
        'unmarked'
    )::integer
  from public.class_sessions
    as session
  join public.academic_periods
    as period
    on period.id =
      session.academic_period_id
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.trainers
    as trainer
    on trainer.id =
      session.trainer_id
  join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  join public.cohorts
    as cohort
    on cohort.id =
      entry.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where session.status <>
      'cancelled'
    and programme.department_id =
      active_department
  group by
    session.id,
    period.name,
    unit.name,
    trainer.full_name
  order by
    session.session_date desc,
    session.starts_at desc
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        100
      ),
      300
    )
  );
end;
$$;

revoke all
on function public.get_department_class_attendance_overview(integer)
from public;

grant execute
on function public.get_department_class_attendance_overview(integer)
to authenticated;

-- ----------------------------------------------------------------------------
-- Department-scoped detailed workspace for HOD oversight.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_class_attendance_workspace(
  target_class_session_id uuid
)
returns table (
  class_session_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_names text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  student_id uuid,
  admission_number text,
  full_name text,
  cohort_name text,
  attendance_status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
begin
  active_department =
    public.current_user_primary_department_id();

  if active_department is null
     or not public.current_user_can_manage_department(
       active_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_sessions
      as session
    join public.class_attendance_entries
      as entry
      on entry.class_session_id =
        session.id
    join public.cohorts
      as cohort
      on cohort.id =
        entry.cohort_id
    join public.programmes
      as programme
      on programme.id =
        cohort.programme_id
    where session.id =
        target_class_session_id
      and programme.department_id =
        active_department
  ) then
    raise exception
      'Class attendance session was not found in the active department.'
      using errcode = 'P0002';
  end if;

  return query
  select
    session.id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    (
      select string_agg(
        distinct department_cohort.name,
        ' / '
        order by department_cohort.name
      )
      from public.class_attendance_entries
        as department_entry
      join public.cohorts
        as department_cohort
        on department_cohort.id =
          department_entry.cohort_id
      join public.programmes
        as department_programme
        on department_programme.id =
          department_cohort.programme_id
      where department_entry.class_session_id =
          session.id
        and department_programme.department_id =
          active_department
    ),
    trainer.full_name,
    session.starts_at,
    session.ends_at,
    student.id,
    student.admission_number,
    student.full_name,
    cohort.name,
    entry.attendance_status,
    entry.note
  from public.class_sessions
    as session
  join public.academic_periods
    as period
    on period.id =
      session.academic_period_id
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.trainers
    as trainer
    on trainer.id =
      session.trainer_id
  join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  join public.students
    as student
    on student.id =
      entry.student_id
  join public.cohorts
    as cohort
    on cohort.id =
      entry.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where session.id =
      target_class_session_id
    and programme.department_id =
      active_department
  order by
    cohort.name,
    student.full_name,
    student.admission_number;
end;
$$;

revoke all
on function public.get_department_class_attendance_workspace(uuid)
from public;

grant execute
on function public.get_department_class_attendance_workspace(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Department-scoped controlled reopen.
-- ----------------------------------------------------------------------------

create or replace function public.reopen_class_attendance_session(
  target_class_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
  active_department uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  active_department =
    public.current_user_primary_department_id();

  if active_department is null
     or not public.current_user_can_manage_department(
       active_department
     )
  then
    raise exception
      'Only an authorized HOD or system administrator can reopen attendance.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_sessions
      as session
    join public.class_attendance_entries
      as entry
      on entry.class_session_id =
        session.id
    join public.cohorts
      as cohort
      on cohort.id =
        entry.cohort_id
    join public.programmes
      as programme
      on programme.id =
        cohort.programme_id
    where session.id =
        target_class_session_id
      and programme.department_id =
        active_department
  ) then
    raise exception
      'This attendance session is outside the active department.'
      using errcode = '42501';
  end if;

  select
    status
  into current_status
  from public.class_sessions
  where id =
    target_class_session_id
  for update;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if current_status <>
    'completed'
  then
    raise exception
      'Only completed attendance can be reopened.'
      using errcode = '23514';
  end if;

  update public.class_sessions
  set
    status =
      'open',
    reopened_at =
      now(),
    reopened_by =
      auth.uid(),
    completed_at =
      null,
    completed_by =
      null,
    updated_at =
      now()
  where id =
    target_class_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    from_status,
    to_status,
    actor_id
  )
  values (
    target_class_session_id,
    'session_reopened',
    'completed',
    'open',
    auth.uid()
  );
end;
$$;

comment on function public.current_user_can_access_class_attendance(uuid, uuid) is
  'Authorizes trainer access by allocation and HOD/system-admin access only through a participant cohort owned by the active managed department.';

comment on function public.get_department_class_attendance_overview(integer) is
  'Returns current active-department class-attendance sessions and counts scoped to that department students.';

comment on function public.get_department_class_attendance_workspace(uuid) is
  'Returns one class-attendance session with only students belonging to the caller active managed department.';

commit;
