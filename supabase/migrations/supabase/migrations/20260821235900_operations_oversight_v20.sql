begin;

-- ============================================================================
-- Academic Planner V20 â€” Operations, Oversight & QA
--
-- Adds department-scoped, read-only management projections for:
-- - cross-module operational snapshot
-- - class-attendance oversight
-- - unified recent audit feed
--
-- All write operations remain in their owning modules/RPCs.
-- ============================================================================

create or replace function public.get_department_operations_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
  active_period_id uuid;
  active_period_name text;

  eligible_students integer := 0;
  portal_issued integer := 0;
  portal_active integer := 0;
  registered_students integer := 0;
  unregistered_students integer := 0;

  active_allocations integer := 0;
  published_sessions integer := 0;

  assessment_total integer := 0;
  assessment_submitted integer := 0;
  assessment_finalised integer := 0;
  assessment_published integer := 0;

  active_templates integer := 0;
  document_in_progress integer := 0;
  document_submitted integer := 0;
  document_returned integer := 0;
  document_approved integer := 0;

  attendance_open integer := 0;
  attendance_completed integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Operations oversight is limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  active_department =
    public.current_user_primary_department_id();

  if active_department is null then
    raise exception
      'No active department is available.'
      using errcode = '42501';
  end if;

  select
    period.id,
    period.name
  into
    active_period_id,
    active_period_name
  from public.academic_periods
    as period
  where period.status::text =
    'active'
  order by
    period.starts_on desc
  limit 1;

  select
    count(*)::integer
  into eligible_students
  from public.students
    as student
  where student.department_id =
      active_department
    and student.lifecycle_status::text in (
      'admitted',
      'active'
    );

  select
    count(*) filter (
      where credential.student_id is not null
    )::integer,
    count(*) filter (
      where credential.is_active is true
    )::integer
  into
    portal_issued,
    portal_active
  from public.students
    as student
  left join public.student_portal_credentials
    as credential
    on credential.student_id =
      student.id
  where student.department_id =
      active_department
    and student.lifecycle_status::text in (
      'admitted',
      'active'
    );

  if active_period_id is not null then
    select
      count(
        distinct registration.student_id
      )::integer
    into registered_students
    from public.student_unit_registrations
      as registration
    join public.students
      as student
      on student.id =
        registration.student_id
    where student.department_id =
        active_department
      and registration.academic_period_id =
        active_period_id
      and registration.registration_status::text =
        'registered';

    unregistered_students =
      greatest(
        0,
        eligible_students -
        registered_students
      );

    select
      count(*)::integer
    into active_allocations
    from public.teaching_allocations
      as allocation
    join public.units
      as unit
      on unit.id =
        allocation.unit_id
    where allocation.academic_period_id =
        active_period_id
      and unit.department_id =
        active_department
      and allocation.status::text =
        'active';

    select
      count(*)::integer
    into published_sessions
    from public.scheduled_sessions
      as session
    join public.units
      as unit
      on unit.id =
        session.unit_id
    where session.academic_period_id =
        active_period_id
      and unit.department_id =
        active_department
      and session.status::text =
        'locked';

    select
      count(*)::integer,
      count(*) filter (
        where event.operational_workflow_status =
          'submitted'
      )::integer,
      count(*) filter (
        where event.operational_workflow_status =
          'finalised'
      )::integer,
      count(*) filter (
        where event.published_at is not null
      )::integer
    into
      assessment_total,
      assessment_submitted,
      assessment_finalised,
      assessment_published
    from public.assessment_events
      as event
    where event.department_id =
        active_department
      and event.academic_period_id =
        active_period_id;

    select
      count(*) filter (
        where document.status in (
          'draft',
          'generated'
        )
      )::integer,
      count(*) filter (
        where document.status =
          'submitted'
      )::integer,
      count(*) filter (
        where document.status =
          'returned'
      )::integer,
      count(*) filter (
        where document.status =
          'approved'
      )::integer
    into
      document_in_progress,
      document_submitted,
      document_returned,
      document_approved
    from public.teaching_documents
      as document
    join public.units
      as unit
      on unit.id =
        document.unit_id
    where document.academic_period_id =
        active_period_id
      and unit.department_id =
        active_department;

    select
      count(*) filter (
        where session.status =
          'open'
      )::integer,
      count(*) filter (
        where session.status =
          'completed'
      )::integer
    into
      attendance_open,
      attendance_completed
    from public.class_sessions
      as session
    join public.units
      as unit
      on unit.id =
        session.unit_id
    where session.academic_period_id =
        active_period_id
      and unit.department_id =
        active_department
      and session.status <>
        'cancelled';
  end if;

  select
    count(*)::integer
  into active_templates
  from public.teaching_document_templates
  where status =
    'active';

  return jsonb_build_object(
    'activePeriodId',
    active_period_id,
    'activePeriodName',
    active_period_name,

    'students',
    jsonb_build_object(
      'eligible',
      eligible_students,
      'portalIssued',
      portal_issued,
      'portalActive',
      portal_active,
      'registered',
      registered_students,
      'unregistered',
      unregistered_students
    ),

    'timetable',
    jsonb_build_object(
      'activeAllocations',
      active_allocations,
      'publishedSessions',
      published_sessions
    ),

    'assessment',
    jsonb_build_object(
      'total',
      assessment_total,
      'submitted',
      assessment_submitted,
      'finalised',
      assessment_finalised,
      'published',
      assessment_published
    ),

    'documents',
    jsonb_build_object(
      'activeTemplates',
      active_templates,
      'inProgress',
      document_in_progress,
      'submitted',
      document_submitted,
      'returned',
      document_returned,
      'approved',
      document_approved
    ),

    'attendance',
    jsonb_build_object(
      'open',
      attendance_open,
      'completed',
      attendance_completed
    )
  );
end;
$$;

revoke all
on function public.get_department_operations_snapshot()
from public;

grant execute
on function public.get_department_operations_snapshot()
to authenticated;

-- ----------------------------------------------------------------------------
-- Department class-attendance oversight.
-- ----------------------------------------------------------------------------

drop function if exists public.get_department_class_attendance_overview(integer);

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
  cohort_name text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  present_count integer,
  absent_count integer,
  unmarked_count integer,
  opened_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Attendance oversight is limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  active_department =
    public.current_user_primary_department_id();

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    cohort.name,
    trainer.full_name,
    session.starts_at,
    session.ends_at,
    session.roster_count,
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
    )::integer,
    session.opened_at,
    session.completed_at
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
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
  join public.trainers
    as trainer
    on trainer.id =
      session.trainer_id
  left join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  where unit.department_id =
      active_department
    and session.status <>
      'cancelled'
  group by
    session.id,
    period.name,
    unit.name,
    cohort.name,
    trainer.full_name
  order by
    session.session_date desc,
    session.starts_at desc,
    unit.name,
    cohort.name
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        100
      ),
      500
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
-- Unified recent operational audit feed.
--
-- This is intentionally a projection over owning-module immutable history.
-- It does not create a second source of truth.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_operations_audit(
  target_limit integer default 100
)
returns table (
  occurred_at timestamptz,
  area text,
  event_type text,
  subject text,
  actor_name text,
  detail text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Operational audit access is limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  active_department =
    public.current_user_primary_department_id();

  return query
  select
    combined.occurred_at,
    combined.area,
    combined.event_type,
    combined.subject,
    combined.actor_name,
    combined.detail
  from (
    select
      access_event.created_at
        as occurred_at,
      'Student access'::text
        as area,
      access_event.event_type::text
        as event_type,
      concat(
        student.full_name,
        ' Â· ',
        student.admission_number
      )::text
        as subject,
      coalesce(
        actor.full_name,
        'System'
      )::text
        as actor_name,
      null::text
        as detail
    from public.student_portal_access_events
      as access_event
    join public.students
      as student
      on student.id =
        access_event.student_id
    left join public.profiles
      as actor
      on actor.id =
        access_event.actor_id
    where access_event.department_id =
      active_department

    union all

    select
      attendance_event.occurred_at,
      'Class attendance'::text,
      attendance_event.event_type::text,
      concat(
        unit.name,
        ' Â· ',
        cohort.name,
        ' Â· ',
        class_session.session_date::text
      )::text,
      coalesce(
        actor.full_name,
        'System'
      )::text,
      case
        when attendance_event.student_id is not null
        then concat(
          student.full_name,
          ': ',
          coalesce(
            attendance_event.from_status,
            'unmarked'
          ),
          ' â†’ ',
          coalesce(
            attendance_event.to_status,
            ''
          )
        )
        else concat(
          coalesce(
            attendance_event.from_status,
            ''
          ),
          case
            when attendance_event.from_status is not null
            then ' â†’ '
            else ''
          end,
          coalesce(
            attendance_event.to_status,
            ''
          )
        )
      end::text
    from public.class_attendance_events
      as attendance_event
    join public.class_sessions
      as class_session
      on class_session.id =
        attendance_event.class_session_id
    join public.units
      as unit
      on unit.id =
        class_session.unit_id
    join public.cohorts
      as cohort
      on cohort.id =
        class_session.cohort_id
    left join public.students
      as student
      on student.id =
        attendance_event.student_id
    left join public.profiles
      as actor
      on actor.id =
        attendance_event.actor_id
    where unit.department_id =
      active_department

    union all

    select
      review.reviewed_at,
      'Teaching documents'::text,
      review.decision::text,
      concat(
        unit.name,
        ' Â· ',
        replace(
          document.document_type,
          '_',
          ' '
        )
      )::text,
      coalesce(
        actor.full_name,
        'System'
      )::text,
      review.note::text
    from public.teaching_document_reviews
      as review
    join public.teaching_documents
      as document
      on document.id =
        review.document_id
    join public.units
      as unit
      on unit.id =
        document.unit_id
    left join public.profiles
      as actor
      on actor.id =
        review.reviewed_by
    where unit.department_id =
      active_department

    union all

    select
      submission.submitted_at,
      'Assessment'::text,
      'online_marks_submitted'::text,
      concat(
        unit.name,
        ' Â· ',
        coalesce(
          event.operational_assessment_type,
          'assessment'
        )
      )::text,
      coalesce(
        actor.full_name,
        'System'
      )::text,
      concat(
        submission.result_count,
        ' results Â· ',
        submission.absent_count,
        ' absent'
      )::text
    from public.assessment_online_mark_submissions
      as submission
    join public.assessment_events
      as event
      on event.id =
        submission.assessment_id
    join public.units
      as unit
      on unit.id =
        event.unit_id
    left join public.profiles
      as actor
      on actor.id =
        submission.submitted_by
    where event.department_id =
      active_department
  ) as combined
  order by
    combined.occurred_at desc
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        100
      ),
      500
    )
  );
end;
$$;

revoke all
on function public.get_department_operations_audit(integer)
from public;

grant execute
on function public.get_department_operations_audit(integer)
to authenticated;

comment on function public.get_department_operations_snapshot() is
  'Department-scoped cross-module operational snapshot for HOD/system-admin readiness and reporting.';

comment on function public.get_department_class_attendance_overview(integer) is
  'Department class-attendance oversight projection for management review.';

comment on function public.get_department_operations_audit(integer) is
  'Unified read-only projection over immutable operational history owned by student access, class attendance, teaching documents and online assessment modules.';

commit;
