begin;

-- ============================================================================
-- Academic Planner V20 — Release Candidate Operations
--
-- Adds three production-facing controls:
-- 1. Controlled student publication of approved teaching documents.
-- 2. HOD department-wide class-attendance oversight.
-- 3. Department release-readiness summary for operational QA.
--
-- Existing trainer, assessment, timetable and teaching-document workflows
-- remain authoritative. No approved document is student-visible until an
-- HOD/system administrator explicitly publishes it.
-- ============================================================================

alter table public.teaching_documents
  add column if not exists student_published_at timestamptz;

alter table public.teaching_documents
  add column if not exists student_published_by uuid
    references public.profiles(id)
    on delete set null;

create index if not exists
  teaching_documents_student_publication_idx
on public.teaching_documents (
  cohort_id,
  student_published_at desc
)
where
  status = 'approved'
  and student_published_at is not null;

-- ----------------------------------------------------------------------------
-- Publish/unpublish one approved teaching document to the student portal.
-- ----------------------------------------------------------------------------

create or replace function public.set_teaching_document_student_publication(
  target_document_id uuid,
  target_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_document record;
  selected_department uuid;
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
      'Only an HOD or system administrator can publish teaching documents to students.'
      using errcode = '42501';
  end if;

  select
    document.id,
    document.status,
    document.approved_revision_number,
    programme.department_id
  into selected_document
  from public.teaching_documents
    as document
  join public.cohorts
    as cohort
    on cohort.id =
      document.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where document.id =
    target_document_id
  for update of document;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  selected_department =
    selected_document.department_id;

  if not public.current_user_can_manage_department(
    selected_department
  ) then
    raise exception
      'This teaching document is outside your department.'
      using errcode = '42501';
  end if;

  if target_published then
    if selected_document.status <> 'approved' then
      raise exception
        'Only an approved teaching document can be published to students.'
        using errcode = '23514';
    end if;

    if selected_document.approved_revision_number is null then
      raise exception
        'The approved document revision is missing.'
        using errcode = '23514';
    end if;

    update public.teaching_documents
    set
      student_published_at =
        coalesce(
          student_published_at,
          now()
        ),
      student_published_by =
        auth.uid(),
      updated_at =
        now()
    where id =
      target_document_id;
  else
    update public.teaching_documents
    set
      student_published_at =
        null,
      student_published_by =
        null,
      updated_at =
        now()
    where id =
      target_document_id;
  end if;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'published',
    target_published
  );
end;
$$;

revoke all
on function public.set_teaching_document_student_publication(
  uuid,
  boolean
)
from public;

grant execute
on function public.set_teaching_document_student_publication(
  uuid,
  boolean
)
to authenticated;

-- ----------------------------------------------------------------------------
-- HOD release queue. Department-scoped and approved documents only.
-- ----------------------------------------------------------------------------

create or replace function public.get_teaching_document_student_release_queue()
returns table (
  document_id uuid,
  document_type text,
  version_number integer,
  approved_revision_number integer,
  approved_at timestamptz,
  student_published_at timestamptz,
  original_filename text,
  unit_name text,
  cohort_name text,
  academic_period_name text,
  trainer_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department uuid;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  return query
  select
    document.id,
    document.document_type,
    document.version_number,
    document.approved_revision_number,
    document.approved_at,
    document.student_published_at,
    document.original_filename,
    unit.name,
    cohort.name,
    period.name,
    trainer.full_name
  from public.teaching_documents
    as document
  join public.cohorts
    as cohort
    on cohort.id =
      document.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  join public.units
    as unit
    on unit.id =
      document.unit_id
  join public.academic_periods
    as period
    on period.id =
      document.academic_period_id
  join public.trainers
    as trainer
    on trainer.id =
      document.trainer_id
  where programme.department_id =
      selected_department
    and document.status =
      'approved'
    and document.approved_revision_number
      is not null
  order by
    document.student_published_at is null desc,
    document.approved_at desc nulls last,
    unit.name,
    cohort.name;
end;
$$;

revoke all
on function public.get_teaching_document_student_release_queue()
from public;

grant execute
on function public.get_teaching_document_student_release_queue()
to authenticated;

-- ----------------------------------------------------------------------------
-- Department-wide class attendance oversight.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_class_attendance_oversight(
  target_limit integer default 100
)
returns table (
  class_session_id uuid,
  session_date date,
  session_status text,
  unit_name text,
  cohort_name text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  present_count integer,
  absent_count integer,
  unmarked_count integer,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department uuid;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  return query
  select
    session.id,
    session.session_date,
    session.status,
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
    session.completed_at
  from public.class_sessions
    as session
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.trainers
    as trainer
    on trainer.id =
      session.trainer_id
  left join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  where programme.department_id =
      selected_department
    and session.status <>
      'cancelled'
  group by
    session.id,
    unit.name,
    cohort.name,
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
      500
    )
  );
end;
$$;

revoke all
on function public.get_department_class_attendance_oversight(integer)
from public;

grant execute
on function public.get_department_class_attendance_oversight(integer)
to authenticated;

-- ----------------------------------------------------------------------------
-- Department release-readiness summary.
--
-- Counts are operational signals, not a substitute for detailed reports.
-- ----------------------------------------------------------------------------

create or replace function public.get_department_release_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department uuid;
  active_period_id uuid;

  student_eligible integer := 0;
  student_access_issued integer := 0;
  student_access_active integer := 0;

  attendance_open integer := 0;
  attendance_completed integer := 0;
  attendance_incomplete integer := 0;

  document_submitted integer := 0;
  document_returned integer := 0;
  document_approved_unpublished integer := 0;
  document_student_published integer := 0;

  assessment_total integer := 0;
  assessment_submitted integer := 0;
  assessment_finalised integer := 0;
  assessment_unpublished_finalised integer := 0;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  select
    period.id
  into active_period_id
  from public.academic_periods
    as period
  where period.status::text =
    'active'
  order by
    period.starts_on desc
  limit 1;

  select
    count(*)::integer,
    count(credential.student_id)::integer,
    count(*) filter (
      where credential.student_id is not null
        and credential.is_active
    )::integer
  into
    student_eligible,
    student_access_issued,
    student_access_active
  from public.students
    as student
  left join public.student_portal_credentials
    as credential
    on credential.student_id =
      student.id
  where student.department_id =
      selected_department
    and student.lifecycle_status::text in (
      'admitted',
      'active'
    );

  select
    count(*) filter (
      where session.status =
        'open'
    )::integer,
    count(*) filter (
      where session.status =
        'completed'
    )::integer,
    count(*) filter (
      where session.status =
        'open'
        and exists (
          select 1
          from public.class_attendance_entries
            as entry
          where entry.class_session_id =
              session.id
            and entry.attendance_status =
              'unmarked'
        )
    )::integer
  into
    attendance_open,
    attendance_completed,
    attendance_incomplete
  from public.class_sessions
    as session
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where programme.department_id =
      selected_department
    and session.status <>
      'cancelled'
    and (
      active_period_id is null
      or session.academic_period_id =
        active_period_id
    );

  select
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
        and document.student_published_at is null
    )::integer,
    count(*) filter (
      where document.status =
        'approved'
        and document.student_published_at is not null
    )::integer
  into
    document_submitted,
    document_returned,
    document_approved_unpublished,
    document_student_published
  from public.teaching_documents
    as document
  join public.cohorts
    as cohort
    on cohort.id =
      document.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where programme.department_id =
      selected_department
    and (
      active_period_id is null
      or document.academic_period_id =
        active_period_id
    );

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
      where event.operational_workflow_status =
        'finalised'
        and event.published_at is null
    )::integer
  into
    assessment_total,
    assessment_submitted,
    assessment_finalised,
    assessment_unpublished_finalised
  from public.assessment_events
    as event
  where event.department_id =
      selected_department
    and (
      active_period_id is null
      or event.academic_period_id =
        active_period_id
    );

  return jsonb_build_object(
    'activePeriodId',
      active_period_id,
    'students',
      jsonb_build_object(
        'eligible',
          student_eligible,
        'accessIssued',
          student_access_issued,
        'accessActive',
          student_access_active,
        'accessMissing',
          greatest(
            student_eligible -
            student_access_issued,
            0
          )
      ),
    'attendance',
      jsonb_build_object(
        'open',
          attendance_open,
        'completed',
          attendance_completed,
        'incomplete',
          attendance_incomplete
      ),
    'documents',
      jsonb_build_object(
        'awaitingReview',
          document_submitted,
        'returned',
          document_returned,
        'approvedUnpublished',
          document_approved_unpublished,
        'studentPublished',
          document_student_published
      ),
    'assessments',
      jsonb_build_object(
        'total',
          assessment_total,
        'submitted',
          assessment_submitted,
        'finalised',
          assessment_finalised,
        'finalisedUnpublished',
          assessment_unpublished_finalised
      )
  );
end;
$$;

revoke all
on function public.get_department_release_readiness()
from public;

grant execute
on function public.get_department_release_readiness()
to authenticated;

comment on function public.set_teaching_document_student_publication(uuid, boolean) is
  'Explicit HOD/system-admin publication boundary for approved teaching documents in the student portal.';

comment on function public.get_department_class_attendance_oversight(integer) is
  'Department-scoped HOD attendance oversight across trainers and published class occurrences.';

comment on function public.get_department_release_readiness() is
  'Department release-candidate operational signals for student access, attendance, teaching documents and assessments.';

commit;
