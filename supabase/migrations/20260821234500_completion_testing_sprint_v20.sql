begin;

-- ============================================================================
-- Academic Planner V20 — Completion & Testing Sprint
--
-- 1. Harden HOD teaching-document access to the active department.
-- 2. Harden HOD class-attendance access to the active department.
-- 3. Add controlled student publication for approved teaching documents.
-- 4. Add immutable student document-download audit.
-- 5. Add HOD class-attendance oversight queries.
-- 6. Add department testing snapshot for system testing.
-- ============================================================================

-- ============================================================================
-- Teaching-document department boundary
-- ============================================================================

create or replace function public.current_user_can_manage_teaching_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    and exists (
      select 1
      from public.teaching_allocations
        as allocation
      join public.cohorts
        as cohort
        on cohort.id =
          allocation.cohort_id
      join public.programmes
        as programme
        on programme.id =
          cohort.programme_id
      where allocation.id =
          target_allocation_id
        and public.current_user_can_manage_department(
          programme.department_id
        )
    );
$$;

revoke all
on function public.current_user_can_manage_teaching_allocation(uuid)
from public;

grant execute
on function public.current_user_can_manage_teaching_allocation(uuid)
to authenticated;

create or replace function public.teaching_document_actor_can_manage_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_can_manage_teaching_allocation(
      target_allocation_id
    )
    or public.trainer_can_access_allocation(
      target_allocation_id
    );
$$;

revoke all
on function public.teaching_document_actor_can_manage_allocation(uuid)
from public;

grant execute
on function public.teaching_document_actor_can_manage_allocation(uuid)
to authenticated;

drop policy if exists
  teaching_documents_hod_all
on public.teaching_documents;

create policy teaching_documents_hod_all
on public.teaching_documents
for all
to authenticated
using (
  public.current_user_can_manage_teaching_allocation(
    allocation_id
  )
)
with check (
  public.current_user_can_manage_teaching_allocation(
    allocation_id
  )
);

drop policy if exists
  teaching_document_revisions_hod_read
on public.teaching_document_revisions;

create policy teaching_document_revisions_hod_read
on public.teaching_document_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_revisions.document_id
      and public.current_user_can_manage_teaching_allocation(
        document.allocation_id
      )
  )
);

drop policy if exists
  teaching_document_submissions_hod_read
on public.teaching_document_submissions;

create policy teaching_document_submissions_hod_read
on public.teaching_document_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_submissions.document_id
      and public.current_user_can_manage_teaching_allocation(
        document.allocation_id
      )
  )
);

drop policy if exists
  teaching_document_reviews_hod_read
on public.teaching_document_reviews;

create policy teaching_document_reviews_hod_read
on public.teaching_document_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_reviews.document_id
      and public.current_user_can_manage_teaching_allocation(
        document.allocation_id
      )
  )
);

-- Review was previously role-gated only. Preserve the same API while adding
-- an explicit allocation -> cohort -> department boundary check.
create or replace function public.review_teaching_document(
  target_document_id uuid,
  target_decision text,
  target_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_row record;
  review_id uuid;
  clean_note text;
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
      'Only an authorized HOD or system administrator may review teaching documents.'
      using errcode = '42501';
  end if;

  if target_decision not in (
    'approved',
    'returned'
  ) then
    raise exception
      'Unsupported review decision.'
      using errcode = '23514';
  end if;

  clean_note =
    nullif(
      trim(
        coalesce(
          target_note,
          ''
        )
      ),
      ''
    );

  if target_decision =
       'returned'
     and clean_note is null
  then
    raise exception
      'A correction note is required when returning a teaching document.'
      using errcode = '23514';
  end if;

  select
    document.id,
    document.allocation_id,
    document.status,
    document.submitted_revision_number
  into document_row
  from public.teaching_documents
    as document
  where document.id =
    target_document_id
  for update;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_teaching_allocation(
    document_row.allocation_id
  ) then
    raise exception
      'This teaching document is outside your active department.'
      using errcode = '42501';
  end if;

  if document_row.status <>
       'submitted'
     or document_row.submitted_revision_number is null
  then
    raise exception
      'Only a submitted teaching document can be reviewed.'
      using errcode = '23514';
  end if;

  insert into public.teaching_document_reviews (
    document_id,
    revision_number,
    decision,
    note,
    reviewed_by
  )
  values (
    target_document_id,
    document_row.submitted_revision_number,
    target_decision,
    clean_note,
    auth.uid()
  )
  returning id
  into review_id;

  if target_decision =
       'approved'
  then
    update public.teaching_documents
    set
      status =
        'approved',
      approved_at =
        now(),
      approved_by =
        auth.uid(),
      approved_revision_number =
        document_row.submitted_revision_number,
      review_note =
        clean_note,
      returned_at =
        null,
      returned_by =
        null,
      updated_at =
        now(),
      updated_by =
        auth.uid()
    where id =
      target_document_id;
  else
    update public.teaching_documents
    set
      status =
        'returned',
      returned_at =
        now(),
      returned_by =
        auth.uid(),
      review_note =
        clean_note,
      approved_at =
        null,
      approved_by =
        null,
      approved_revision_number =
        null,
      updated_at =
        now(),
      updated_by =
        auth.uid()
    where id =
      target_document_id;
  end if;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'reviewId',
    review_id,
    'revisionNumber',
    document_row.submitted_revision_number,
    'status',
    target_decision
  );
end;
$$;

revoke all
on function public.review_teaching_document(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.review_teaching_document(
  uuid,
  text,
  text
)
to authenticated;

-- ============================================================================
-- Controlled student publication
-- ============================================================================

alter table public.teaching_documents
  add column if not exists student_visible boolean
    not null
    default false;

alter table public.teaching_documents
  add column if not exists student_visible_at timestamptz;

alter table public.teaching_documents
  add column if not exists student_visible_by uuid
    references public.profiles(id)
    on delete set null;

create index if not exists
  teaching_documents_student_visible_idx
on public.teaching_documents (
  cohort_id,
  academic_period_id,
  unit_id,
  student_visible,
  status
);

create or replace function public.set_teaching_document_student_visibility(
  target_document_id uuid,
  target_visible boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_row record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    document.id,
    document.allocation_id,
    document.status,
    document.approved_revision_number,
    document.student_visible
  into document_row
  from public.teaching_documents
    as document
  where document.id =
    target_document_id
  for update;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_teaching_allocation(
    document_row.allocation_id
  ) then
    raise exception
      'This teaching document is outside your active department.'
      using errcode = '42501';
  end if;

  if target_visible
     and (
       document_row.status <>
         'approved'
       or document_row.approved_revision_number is null
     )
  then
    raise exception
      'Only an approved revision can be published to students.'
      using errcode = '23514';
  end if;

  update public.teaching_documents
  set
    student_visible =
      target_visible,
    student_visible_at =
      case
        when target_visible
        then now()
        else null
      end,
    student_visible_by =
      case
        when target_visible
        then auth.uid()
        else null
      end,
    updated_at =
      now(),
    updated_by =
      auth.uid()
  where id =
    target_document_id;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'studentVisible',
    target_visible
  );
end;
$$;

revoke all
on function public.set_teaching_document_student_visibility(
  uuid,
  boolean
)
from public;

grant execute
on function public.set_teaching_document_student_visibility(
  uuid,
  boolean
)
to authenticated;

create table if not exists public.student_document_download_events (
  id uuid primary key
    default gen_random_uuid(),

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  department_id uuid not null
    references public.departments(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  document_id uuid not null
    references public.teaching_documents(id)
    on delete restrict,

  revision_number integer not null
    check (
      revision_number >= 1
    ),

  downloaded_at timestamptz not null
    default now()
);

create index if not exists
  student_document_download_events_department_idx
on public.student_document_download_events (
  department_id,
  downloaded_at desc
);

create index if not exists
  student_document_download_events_student_idx
on public.student_document_download_events (
  student_id,
  downloaded_at desc
);

alter table public.student_document_download_events
  enable row level security;

drop policy if exists
  student_document_download_events_hod_read
on public.student_document_download_events;

create policy student_document_download_events_hod_read
on public.student_document_download_events
for select
to authenticated
using (
  public.current_user_can_manage_department(
    department_id
  )
  and public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

revoke all
on table public.student_document_download_events
from anon;

revoke insert, update, delete
on table public.student_document_download_events
from authenticated;

grant select
on table public.student_document_download_events
to authenticated;

-- ============================================================================
-- Class-attendance department boundary + HOD oversight
-- ============================================================================

create or replace function public.current_user_can_manage_class_session(
  target_class_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    and exists (
      select 1
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
      where session.id =
          target_class_session_id
        and public.current_user_can_manage_department(
          programme.department_id
        )
    );
$$;

revoke all
on function public.current_user_can_manage_class_session(uuid)
from public;

grant execute
on function public.current_user_can_manage_class_session(uuid)
to authenticated;

drop policy if exists
  class_sessions_authorized_read
on public.class_sessions;

create policy class_sessions_authorized_read
on public.class_sessions
for select
to authenticated
using (
  public.current_user_can_manage_class_session(
    id
  )
  or public.trainer_can_access_allocation(
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
  public.current_user_can_manage_class_session(
    class_session_id
  )
  or exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_entries.class_session_id
      and public.trainer_can_access_allocation(
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
  public.current_user_can_manage_class_session(
    class_session_id
  )
  or exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_events.class_session_id
      and public.trainer_can_access_allocation(
        session.teaching_allocation_id
      )
  )
);

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
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_can_manage_class_session(
    target_class_session_id
  ) then
    raise exception
      'Only the HOD or system administrator for the active department can reopen this attendance session.'
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

revoke all
on function public.reopen_class_attendance_session(uuid)
from public;

grant execute
on function public.reopen_class_attendance_session(uuid)
to authenticated;

create or replace function public.get_hod_class_attendance_overview(
  target_start_date date default null,
  target_end_date date default null
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  session_date date,
  status text,
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
  completed_at timestamptz,
  reopened_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department uuid;
  start_date date;
  end_date date;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_has_role(
       array[
         'hod',
         'system_admin'
       ]::public.app_role[]
     )
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  end_date =
    coalesce(
      target_end_date,
      current_date
    );

  start_date =
    coalesce(
      target_start_date,
      end_date -
        60
    );

  if start_date >
    end_date
  then
    raise exception
      'Attendance start date cannot be after the end date.'
      using errcode = '22023';
  end if;

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
    session.completed_at,
    session.reopened_at
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
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
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
    and session.session_date
      between start_date
      and end_date
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
    cohort.name;
end;
$$;

revoke all
on function public.get_hod_class_attendance_overview(
  date,
  date
)
from public;

grant execute
on function public.get_hod_class_attendance_overview(
  date,
  date
)
to authenticated;

create or replace function public.get_hod_class_attendance_workspace(
  target_class_session_id uuid
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
begin
  if not public.current_user_can_manage_class_session(
    target_class_session_id
  ) then
    raise exception
      'This attendance session is outside your active department.'
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
    cohort.name,
    trainer.full_name,
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
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
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
  where session.id =
    target_class_session_id
  order by
    student.full_name,
    student.admission_number;
end;
$$;

revoke all
on function public.get_hod_class_attendance_workspace(uuid)
from public;

grant execute
on function public.get_hod_class_attendance_workspace(uuid)
to authenticated;

-- ============================================================================
-- Department testing snapshot
-- ============================================================================

create or replace function public.get_department_testing_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department uuid;
  active_period record;

  total_students integer := 0;
  active_students integer := 0;
  issued_access integer := 0;
  active_access integer := 0;

  allocation_count integer := 0;
  published_session_count integer := 0;

  assessment_count integer := 0;
  published_assessment_count integer := 0;

  active_template_count integer := 0;
  document_count integer := 0;
  submitted_document_count integer := 0;
  approved_document_count integer := 0;
  student_visible_document_count integer := 0;

  attendance_session_count integer := 0;
  open_attendance_count integer := 0;
  completed_attendance_count integer := 0;

  download_count integer := 0;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_has_role(
       array[
         'hod',
         'system_admin'
       ]::public.app_role[]
     )
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  select
    period.id,
    period.name
  into active_period
  from public.academic_periods
    as period
  where period.status::text =
    'active'
  order by
    period.starts_on desc
  limit 1;

  select
    count(*)::integer,
    count(*) filter (
      where student.lifecycle_status::text in (
        'admitted',
        'active'
      )
    )::integer
  into
    total_students,
    active_students
  from public.students
    as student
  where student.department_id =
    selected_department;

  select
    count(credential.student_id)::integer,
    count(credential.student_id) filter (
      where credential.is_active
    )::integer
  into
    issued_access,
    active_access
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
    count(*)::integer
  into allocation_count
  from public.teaching_allocations
    as allocation
  join public.cohorts
    as cohort
    on cohort.id =
      allocation.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where programme.department_id =
      selected_department
    and (
      active_period.id is null
      or allocation.academic_period_id =
        active_period.id
    );

  select
    count(*)::integer
  into published_session_count
  from public.scheduled_sessions
    as scheduled
  join public.cohorts
    as cohort
    on cohort.id =
      scheduled.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where programme.department_id =
      selected_department
    and scheduled.status::text =
      'locked'
    and (
      active_period.id is null
      or scheduled.academic_period_id =
        active_period.id
    );

  select
    count(*)::integer,
    count(*) filter (
      where assessment.published_at is not null
    )::integer
  into
    assessment_count,
    published_assessment_count
  from public.assessment_events
    as assessment
  where assessment.department_id =
      selected_department
    and (
      active_period.id is null
      or assessment.academic_period_id =
        active_period.id
    );

  select
    count(*)::integer
  into active_template_count
  from public.teaching_document_templates
  where status =
    'active';

  select
    count(*)::integer,
    count(*) filter (
      where document.status =
        'submitted'
    )::integer,
    count(*) filter (
      where document.status =
        'approved'
    )::integer,
    count(*) filter (
      where document.status =
        'approved'
        and document.student_visible
    )::integer
  into
    document_count,
    submitted_document_count,
    approved_document_count,
    student_visible_document_count
  from public.teaching_documents
    as document
  join public.teaching_allocations
    as allocation
    on allocation.id =
      document.allocation_id
  join public.cohorts
    as cohort
    on cohort.id =
      allocation.cohort_id
  join public.programmes
    as programme
    on programme.id =
      cohort.programme_id
  where programme.department_id =
      selected_department
    and (
      active_period.id is null
      or document.academic_period_id =
        active_period.id
    );

  select
    count(*)::integer,
    count(*) filter (
      where session.status =
        'open'
    )::integer,
    count(*) filter (
      where session.status =
        'completed'
    )::integer
  into
    attendance_session_count,
    open_attendance_count,
    completed_attendance_count
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
      active_period.id is null
      or session.academic_period_id =
        active_period.id
    );

  select
    count(*)::integer
  into download_count
  from public.student_document_download_events
  where department_id =
    selected_department;

  return jsonb_build_object(
    'departmentId',
    selected_department,
    'activePeriod',
    case
      when active_period.id is null
      then null
      else jsonb_build_object(
        'id',
        active_period.id,
        'name',
        active_period.name
      )
    end,
    'students',
    jsonb_build_object(
      'total',
      total_students,
      'active',
      active_students
    ),
    'studentPortal',
    jsonb_build_object(
      'issued',
      issued_access,
      'active',
      active_access
    ),
    'timetable',
    jsonb_build_object(
      'allocations',
      allocation_count,
      'publishedSessions',
      published_session_count
    ),
    'assessments',
    jsonb_build_object(
      'total',
      assessment_count,
      'published',
      published_assessment_count
    ),
    'documents',
    jsonb_build_object(
      'activeTemplates',
      active_template_count,
      'total',
      document_count,
      'submitted',
      submitted_document_count,
      'approved',
      approved_document_count,
      'studentVisible',
      student_visible_document_count,
      'studentDownloads',
      download_count
    ),
    'attendance',
    jsonb_build_object(
      'sessions',
      attendance_session_count,
      'open',
      open_attendance_count,
      'completed',
      completed_attendance_count
    )
  );
end;
$$;

revoke all
on function public.get_department_testing_snapshot()
from public;

grant execute
on function public.get_department_testing_snapshot()
to authenticated;

comment on column public.teaching_documents.student_visible is
  'Explicit HOD-controlled publication flag. Approved documents remain private from students until enabled.';

comment on table public.student_document_download_events is
  'Immutable audit trail for approved teaching-document downloads from the custom student portal.';

comment on function public.get_department_testing_snapshot() is
  'Compact active-department operational snapshot used by the System Testing Center.';

commit;
