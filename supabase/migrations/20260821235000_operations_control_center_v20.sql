begin;

-- ============================================================================
-- Academic Operations Control Center V20
--
-- Adds department-scoped read models for:
--   1. HOD class-attendance oversight
--   2. Action Centre queues
--   3. Unified operational history
--
-- Existing transactional workflows remain the source of truth.
-- ============================================================================

create or replace function public.get_hod_class_attendance_overview(
  target_limit integer default 100
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
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
  completed_at timestamptz,
  reopened_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
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
      'HOD access is required.'
      using errcode = '42501';
  end if;

  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable department is active.'
      using errcode = '42501';
  end if;

  return query
  select
    session.id,
    session.teaching_allocation_id,
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
    session.completed_at,
    session.reopened_at
  from public.class_sessions
    as session
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
      department_uuid
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
on function public.get_hod_class_attendance_overview(integer)
from public;

grant execute
on function public.get_hod_class_attendance_overview(integer)
to authenticated;

create or replace function public.get_academic_operations_action_center()
returns table (
  action_key text,
  action_label text,
  action_count integer,
  severity text,
  href text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
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
      'HOD access is required.'
      using errcode = '42501';
  end if;

  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable department is active.'
      using errcode = '42501';
  end if;

  return query
  with
  attendance_open as (
    select
      count(distinct session.id)::integer
        as value
    from public.class_sessions
      as session
    join public.units
      as unit
      on unit.id =
        session.unit_id
    where unit.department_id =
        department_uuid
      and session.status =
        'open'
  ),
  attendance_incomplete as (
    select
      count(distinct session.id)::integer
        as value
    from public.class_sessions
      as session
    join public.units
      as unit
      on unit.id =
        session.unit_id
    join public.class_attendance_entries
      as entry
      on entry.class_session_id =
        session.id
    where unit.department_id =
        department_uuid
      and session.status =
        'open'
      and entry.attendance_status =
        'unmarked'
  ),
  document_review as (
    select
      count(*)::integer
        as value
    from public.teaching_documents
      as document
    join public.units
      as unit
      on unit.id =
        document.unit_id
    where unit.department_id =
        department_uuid
      and document.status =
        'submitted'
  ),
  document_returned as (
    select
      count(*)::integer
        as value
    from public.teaching_documents
      as document
    join public.units
      as unit
      on unit.id =
        document.unit_id
    where unit.department_id =
        department_uuid
      and document.status =
        'returned'
  ),
  assessment_submitted as (
    select
      count(*)::integer
        as value
    from public.assessment_event_workspace
      as workspace
    join public.units
      as unit
      on unit.id =
        workspace.unit_id
    where unit.department_id =
        department_uuid
      and workspace.workflow_status =
        'submitted'
  ),
  assessment_unpublished as (
    select
      count(*)::integer
        as value
    from public.assessment_event_workspace
      as workspace
    join public.assessment_events
      as event
      on event.id =
        workspace.id
    join public.units
      as unit
      on unit.id =
        workspace.unit_id
    where unit.department_id =
        department_uuid
      and workspace.workflow_status =
        'finalised'
      and event.published_at is null
  )
  select *
  from (
    values
      (
        'attendance_incomplete'::text,
        'Incomplete attendance'::text,
        (
          select value
          from attendance_incomplete
        ),
        'warning'::text,
        '/attendance'::text
      ),
      (
        'attendance_open'::text,
        'Open attendance sessions'::text,
        (
          select value
          from attendance_open
        ),
        'info'::text,
        '/attendance'::text
      ),
      (
        'document_review'::text,
        'Documents awaiting review'::text,
        (
          select value
          from document_review
        ),
        'warning'::text,
        '/teaching-documents/review'::text
      ),
      (
        'document_returned'::text,
        'Documents returned'::text,
        (
          select value
          from document_returned
        ),
        'info'::text,
        '/teaching-documents'::text
      ),
      (
        'assessment_submitted'::text,
        'Assessments awaiting finalisation'::text,
        (
          select value
          from assessment_submitted
        ),
        'warning'::text,
        '/assessment'::text
      ),
      (
        'assessment_unpublished'::text,
        'Finalised assessments not published'::text,
        (
          select value
          from assessment_unpublished
        ),
        'danger'::text,
        '/assessment'::text
      )
  ) as action_rows(
    action_key,
    action_label,
    action_count,
    severity,
    href
  )
  order by
    case severity
      when 'danger'
        then 1
      when 'warning'
        then 2
      when 'info'
        then 3
      else 4
    end,
    action_label;
end;
$$;

revoke all
on function public.get_academic_operations_action_center()
from public;

grant execute
on function public.get_academic_operations_action_center()
to authenticated;

create or replace function public.get_academic_operations_history(
  target_limit integer default 100
)
returns table (
  event_key text,
  module text,
  event_type text,
  title text,
  detail text,
  occurred_at timestamptz,
  href text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
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
      'HOD access is required.'
      using errcode = '42501';
  end if;

  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable department is active.'
      using errcode = '42501';
  end if;

  return query
  with events as (
    select
      'attendance:' ||
      attendance_event.id::text
        as event_key,
      'Attendance'::text
        as module,
      attendance_event.event_type,
      unit.name
        as title,
      (
        cohort.name ||
        ' · ' ||
        session.session_date::text ||
        case
          when attendance_event.to_status is not null
          then
            ' · ' ||
            attendance_event.to_status
          else
            ''
        end
      )::text
        as detail,
      attendance_event.occurred_at,
      (
        '/attendance/' ||
        session.id::text
      )::text
        as href
    from public.class_attendance_events
      as attendance_event
    join public.class_sessions
      as session
      on session.id =
        attendance_event.class_session_id
    join public.units
      as unit
      on unit.id =
        session.unit_id
    join public.cohorts
      as cohort
      on cohort.id =
        session.cohort_id
    where unit.department_id =
      department_uuid

    union all

    select
      'document-review:' ||
      review.id::text,
      'Teaching Documents',
      (
        'document_' ||
        review.decision
      )::text,
      unit.name,
      (
        document.document_type ||
        ' · revision ' ||
        review.revision_number::text ||
        case
          when review.note is not null
               and trim(
                 review.note
               ) <> ''
          then
            ' · ' ||
            left(
              trim(
                review.note
              ),
              140
            )
          else
            ''
        end
      )::text,
      review.reviewed_at,
      '/teaching-documents/review'
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
    where unit.department_id =
      department_uuid

    union all

    select
      'document-submission:' ||
      submission.id::text,
      'Teaching Documents',
      'document_submitted',
      unit.name,
      (
        document.document_type ||
        ' · revision ' ||
        submission.revision_number::text
      )::text,
      submission.submitted_at,
      '/teaching-documents/review'
    from public.teaching_document_submissions
      as submission
    join public.teaching_documents
      as document
      on document.id =
        submission.document_id
    join public.units
      as unit
      on unit.id =
        document.unit_id
    where unit.department_id =
      department_uuid

    union all

    select
      'markbook:' ||
      generation.id::text,
      'Assessment',
      'markbook_generated',
      unit.name,
      (
        upper(
          generation.assessment_type
        ) ||
        ' · ' ||
        generation.student_count::text ||
        ' students'
      )::text,
      generation.generated_at,
      '/assessment'
    from public.assessment_markbook_generations
      as generation
    join public.units
      as unit
      on unit.id =
        generation.unit_id
    where unit.department_id =
      department_uuid

    union all

    select
      'markbook-import:' ||
      batch.id::text,
      'Assessment',
      (
        'markbook_' ||
        batch.status
      )::text,
      unit.name,
      (
        upper(
          batch.assessment_type
        ) ||
        ' · ' ||
        batch.source_filename
      )::text,
      coalesce(
        batch.committed_at,
        batch.created_at
      ),
      '/assessment'
    from public.assessment_markbook_import_batches
      as batch
    join public.units
      as unit
      on unit.id =
        batch.unit_id
    where unit.department_id =
      department_uuid
  )
  select
    events.event_key,
    events.module,
    events.event_type,
    events.title,
    events.detail,
    events.occurred_at,
    events.href
  from events
  order by
    events.occurred_at desc
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
on function public.get_academic_operations_history(integer)
from public;

grant execute
on function public.get_academic_operations_history(integer)
to authenticated;

comment on function public.get_hod_class_attendance_overview(integer) is
  'Department-scoped HOD view of operational class attendance and completion state.';

comment on function public.get_academic_operations_action_center() is
  'Department-scoped queue counts for attendance, teaching documents and assessment actions requiring attention.';

comment on function public.get_academic_operations_history(integer) is
  'Unified department operational history assembled from existing immutable workflow records.';

commit;
