begin;

-- ============================================================================
-- Academic Planner V22 — Release Candidate Completion Sprint
--
-- 1. Hardens class-attendance authorization to the active department.
-- 2. Adds reusable department attendance analytics RPCs.
-- 3. Extends the release-candidate UAT catalogue for student attendance,
--    attendance analytics/export, and published result component visibility.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- One reusable authorization boundary for a concrete class session.
-- HOD/system-admin access is department-scoped. Trainers retain allocation-
-- scoped access. This closes the institution-wide HOD shortcut in V19.
-- ----------------------------------------------------------------------------

create or replace function public.current_user_can_access_class_session(
  target_class_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.class_sessions as session
    join public.cohorts as cohort
      on cohort.id = session.cohort_id
    join public.programmes as programme
      on programme.id = cohort.programme_id
    where session.id = target_class_session_id
      and (
        public.current_user_can_manage_department(
          programme.department_id
        )
        or public.trainer_can_access_allocation(
          session.teaching_allocation_id
        )
      )
  );
$$;

revoke all
on function public.current_user_can_access_class_session(uuid)
from public;

grant execute
on function public.current_user_can_access_class_session(uuid)
to authenticated;

-- Session policy now honours department ownership for HODs.
drop policy if exists
  class_sessions_authorized_read
on public.class_sessions;

create policy class_sessions_authorized_read
on public.class_sessions
for select
to authenticated
using (
  public.current_user_can_access_class_session(id)
);

-- Child tables use the same class-session authorization boundary.
drop policy if exists
  class_attendance_entries_authorized_read
on public.class_attendance_entries;

create policy class_attendance_entries_authorized_read
on public.class_attendance_entries
for select
to authenticated
using (
  public.current_user_can_access_class_session(
    class_session_id
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
  public.current_user_can_access_class_session(
    class_session_id
  )
);

-- ----------------------------------------------------------------------------
-- Reopen completed attendance only inside the caller's manageable department.
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
  session_department_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    session.status,
    programme.department_id
  into
    current_status,
    session_department_id
  from public.class_sessions as session
  join public.cohorts as cohort
    on cohort.id = session.cohort_id
  join public.programmes as programme
    on programme.id = cohort.programme_id
  where session.id = target_class_session_id
  for update of session;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(
    session_department_id
  ) then
    raise exception
      'This attendance session is outside your active department.'
      using errcode = '42501';
  end if;

  if current_status <> 'completed' then
    raise exception
      'Only completed attendance can be reopened.'
      using errcode = '23514';
  end if;

  update public.class_sessions
  set
    status = 'open',
    reopened_at = now(),
    reopened_by = auth.uid(),
    completed_at = null,
    completed_by = null,
    updated_at = now()
  where id = target_class_session_id;

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

revoke all
on function public.reopen_class_attendance_session(uuid)
from public;

grant execute
on function public.reopen_class_attendance_session(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Department attendance analytics.
-- Only completed sessions contribute to attendance rates.
-- Active academic period is selected automatically.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_attendance_analytics()
returns table (
  academic_period_id uuid,
  academic_period_name text,
  cohort_id uuid,
  cohort_name text,
  unit_id uuid,
  unit_name text,
  trainer_id uuid,
  trainer_name text,
  completed_sessions integer,
  roster_occurrences integer,
  present_count integer,
  absent_count integer,
  attendance_rate numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  period_uuid uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  department_uuid :=
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  select period.id
  into period_uuid
  from public.academic_periods as period
  where period.status::text = 'active'
  order by period.starts_on desc
  limit 1;

  if period_uuid is null then
    return;
  end if;

  return query
  select
    session.academic_period_id,
    period.name,
    session.cohort_id,
    cohort.name,
    session.unit_id,
    unit.name,
    session.trainer_id,
    trainer.full_name,
    count(distinct session.id)::integer,
    count(entry.id)::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'absent'
    )::integer,
    case
      when count(entry.id) filter (
        where entry.attendance_status in (
          'present',
          'absent'
        )
      ) = 0
      then null
      else round(
        100.0 *
        count(entry.id) filter (
          where entry.attendance_status = 'present'
        ) /
        count(entry.id) filter (
          where entry.attendance_status in (
            'present',
            'absent'
          )
        ),
        1
      )
    end
  from public.class_sessions as session
  join public.academic_periods as period
    on period.id = session.academic_period_id
  join public.cohorts as cohort
    on cohort.id = session.cohort_id
  join public.programmes as programme
    on programme.id = cohort.programme_id
  join public.units as unit
    on unit.id = session.unit_id
  join public.trainers as trainer
    on trainer.id = session.trainer_id
  join public.class_attendance_entries as entry
    on entry.class_session_id = session.id
  where session.academic_period_id = period_uuid
    and session.status = 'completed'
    and programme.department_id = department_uuid
  group by
    session.academic_period_id,
    period.name,
    session.cohort_id,
    cohort.name,
    session.unit_id,
    unit.name,
    session.trainer_id,
    trainer.full_name
  order by
    cohort.name,
    unit.name,
    trainer.full_name;
end;
$$;

revoke all
on function public.get_department_attendance_analytics()
from public;

grant execute
on function public.get_department_attendance_analytics()
to authenticated;

create or replace function public.get_department_student_attendance_analytics()
returns table (
  academic_period_id uuid,
  academic_period_name text,
  student_id uuid,
  admission_number text,
  full_name text,
  cohort_id uuid,
  cohort_name text,
  unit_id uuid,
  unit_name text,
  completed_sessions integer,
  present_count integer,
  absent_count integer,
  attendance_rate numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  period_uuid uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  department_uuid :=
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  select period.id
  into period_uuid
  from public.academic_periods as period
  where period.status::text = 'active'
  order by period.starts_on desc
  limit 1;

  if period_uuid is null then
    return;
  end if;

  return query
  select
    session.academic_period_id,
    period.name,
    student.id,
    student.admission_number,
    student.full_name,
    session.cohort_id,
    cohort.name,
    session.unit_id,
    unit.name,
    count(distinct session.id)::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'absent'
    )::integer,
    case
      when count(entry.id) filter (
        where entry.attendance_status in (
          'present',
          'absent'
        )
      ) = 0
      then null
      else round(
        100.0 *
        count(entry.id) filter (
          where entry.attendance_status = 'present'
        ) /
        count(entry.id) filter (
          where entry.attendance_status in (
            'present',
            'absent'
          )
        ),
        1
      )
    end
  from public.class_attendance_entries as entry
  join public.class_sessions as session
    on session.id = entry.class_session_id
  join public.students as student
    on student.id = entry.student_id
  join public.cohorts as cohort
    on cohort.id = session.cohort_id
  join public.programmes as programme
    on programme.id = cohort.programme_id
  join public.units as unit
    on unit.id = session.unit_id
  join public.academic_periods as period
    on period.id = session.academic_period_id
  where session.academic_period_id = period_uuid
    and session.status = 'completed'
    and programme.department_id = department_uuid
    and entry.attendance_status in (
      'present',
      'absent'
    )
  group by
    session.academic_period_id,
    period.name,
    student.id,
    student.admission_number,
    student.full_name,
    session.cohort_id,
    cohort.name,
    session.unit_id,
    unit.name
  order by
    cohort.name,
    student.full_name,
    unit.name;
end;
$$;

revoke all
on function public.get_department_student_attendance_analytics()
from public;

grant execute
on function public.get_department_student_attendance_analytics()
to authenticated;

-- ----------------------------------------------------------------------------
-- Extend the existing 2026.1 release-candidate UAT suite.
-- Upsert keeps the migration safe if catalogue rows were prepared manually.
-- ----------------------------------------------------------------------------

insert into public.release_test_catalog (
  suite_version,
  case_key,
  area,
  title,
  expected_result,
  requirement_level,
  sequence_number,
  is_active
)
values
  (
    '2026.1',
    'student-attendance-self-service',
    'Student portal',
    'Student class attendance visibility',
    'The student sees only their own completed Present/Absent class records and unit attendance summaries.',
    'required',
    91,
    true
  ),
  (
    '2026.1',
    'attendance-department-analytics',
    'Class attendance',
    'Department attendance analytics',
    'The HOD analytics totals reconcile to completed attendance sessions in the active academic period.',
    'required',
    92,
    true
  ),
  (
    '2026.1',
    'attendance-export',
    'Class attendance',
    'Attendance Excel export',
    'The HOD can export active-period attendance summaries and student detail without cross-department data.',
    'required',
    93,
    true
  ),
  (
    '2026.1',
    'student-result-components',
    'Assessment',
    'Published result component breakdown',
    'Published Exam results show the stored Assignment, Presentation, RAT, CAT and Exam components only after result publication.',
    'required',
    94,
    true
  )
on conflict (
  suite_version,
  case_key
)
do update set
  area = excluded.area,
  title = excluded.title,
  expected_result = excluded.expected_result,
  requirement_level = excluded.requirement_level,
  sequence_number = excluded.sequence_number,
  is_active = excluded.is_active;

comment on function public.current_user_can_access_class_session(uuid) is
  'Single department-aware authorization boundary for HOD/system-admin and allocation-aware trainer access to concrete class attendance sessions.';

comment on function public.get_department_attendance_analytics() is
  'Active-period completed-class attendance aggregates by cohort, unit and trainer for the caller managed department.';

comment on function public.get_department_student_attendance_analytics() is
  'Active-period completed-class attendance aggregates by student and unit for the caller managed department.';

commit;
