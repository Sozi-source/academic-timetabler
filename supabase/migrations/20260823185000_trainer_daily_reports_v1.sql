begin;

-- ============================================================================
-- Academic Planner — Trainer Daily Reports V1
--
-- Current published timetable -> scheduled lessons
-- Completed Class Attendance -> absentees
-- Trainer input -> brief activity / concern
-- Submitted report -> immutable management snapshot
-- ============================================================================

create table if not exists public.trainer_daily_reports (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  trainer_profile_id uuid not null references public.profiles(id) on delete restrict,
  home_department_id uuid not null references public.departments(id) on delete restrict,
  trainer_name_snapshot text not null
    check (char_length(trim(trainer_name_snapshot)) between 1 and 200),
  trainer_number_snapshot text,
  home_department_name_snapshot text not null
    check (char_length(trim(home_department_name_snapshot)) between 1 and 200),
  report_date date not null,
  other_activity text
    check (other_activity is null or char_length(other_activity) <= 800),
  concern text
    check (concern is null or char_length(concern) <= 1200),
  status text not null default 'submitted'
    check (status in ('submitted','voided')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint trainer_daily_reports_one_per_trainer_date
    unique (trainer_id, report_date)
);

create index if not exists trainer_daily_reports_department_date_idx
  on public.trainer_daily_reports (home_department_id, report_date desc);

create index if not exists trainer_daily_reports_date_idx
  on public.trainer_daily_reports (report_date desc, submitted_at desc);

create table if not exists public.trainer_daily_report_lessons (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.trainer_daily_reports(id) on delete cascade,
  department_id uuid not null
    references public.departments(id) on delete restrict,
  department_name_snapshot text not null,
  timetable_version_id uuid not null
    references public.timetable_versions(id) on delete restrict,
  timetable_version_number integer not null
    check (timetable_version_number >= 1),
  timetable_title text not null,
  scheduled_session_id uuid not null,
  teaching_allocation_id uuid not null
    references public.teaching_allocations(id) on delete restrict,
  academic_period_id uuid not null
    references public.academic_periods(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  session_number integer not null check (session_number between 1 and 50),
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  unit_code_snapshot text not null,
  unit_name_snapshot text not null,
  cohort_name_snapshot text not null,
  room_name_snapshot text,
  delivery_mode_snapshot text not null,
  attendance_session_id uuid
    references public.class_sessions(id) on delete restrict,
  roster_count integer not null default 0 check (roster_count >= 0),
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  absentees jsonb not null default '[]'::jsonb
    check (jsonb_typeof(absentees) = 'array'),
  created_at timestamptz not null default now(),
  constraint trainer_daily_report_lessons_time_order
    check (ends_at > starts_at),
  constraint trainer_daily_report_lessons_one_session
    unique (report_id, scheduled_session_id)
);

create index if not exists trainer_daily_report_lessons_department_idx
  on public.trainer_daily_report_lessons (department_id, report_id);

create index if not exists trainer_daily_report_lessons_allocation_idx
  on public.trainer_daily_report_lessons (teaching_allocation_id, report_id);

alter table public.trainer_daily_reports enable row level security;
alter table public.trainer_daily_report_lessons enable row level security;

revoke all on public.trainer_daily_reports,
              public.trainer_daily_report_lessons
from anon;

revoke insert, update, delete
on public.trainer_daily_reports,
   public.trainer_daily_report_lessons
from authenticated;

grant select on public.trainer_daily_reports,
                public.trainer_daily_report_lessons
to authenticated;

drop policy if exists trainer_daily_reports_read
on public.trainer_daily_reports;

create policy trainer_daily_reports_read
on public.trainer_daily_reports
for select
to authenticated
using (
  trainer_profile_id = auth.uid()
  or public.current_user_can_manage_department(home_department_id)
);

drop policy if exists trainer_daily_report_lessons_read
on public.trainer_daily_report_lessons;

create policy trainer_daily_report_lessons_read
on public.trainer_daily_report_lessons
for select
to authenticated
using (
  public.current_user_can_manage_department(department_id)
  or exists (
    select 1
    from public.trainer_daily_reports report
    where report.id = trainer_daily_report_lessons.report_id
      and (
        report.trainer_profile_id = auth.uid()
        or public.current_user_can_manage_department(report.home_department_id)
      )
  )
);

-- Current published timetable schedule for one trainer/date.
create or replace function public._trainer_daily_schedule_v1(
  target_trainer_id uuid,
  target_report_date date
)
returns table (
  department_id uuid,
  department_name text,
  timetable_version_id uuid,
  timetable_version_number integer,
  timetable_title text,
  academic_period_id uuid,
  scheduled_session_id uuid,
  teaching_allocation_id uuid,
  cohort_id uuid,
  unit_id uuid,
  session_number integer,
  starts_at time without time zone,
  ends_at time without time zone,
  unit_code text,
  unit_name text,
  cohort_name text,
  room_name text,
  delivery_mode text
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_schedule as (
    select
      version.department_id,
      department.name as department_name,
      version.id as timetable_version_id,
      version.version_number as timetable_version_number,
      version.title as timetable_title,
      version.academic_period_id,
      item,
      row_number() over (
        partition by nullif(item ->> 'id', '')::uuid
        order by version.version_number desc
      ) as session_rank
    from public.timetable_versions version
    join public.departments department
      on department.id = version.department_id
    join public.academic_periods period
      on period.id = version.academic_period_id
    cross join lateral jsonb_array_elements(version.snapshot) item
    where version.status = 'published'
      and target_report_date between period.teaching_starts_on
                                 and period.teaching_ends_on
      and nullif(item ->> 'trainerId', '')::uuid = target_trainer_id
      and lower(trim(item ->> 'day')) =
          lower(trim(to_char(target_report_date, 'FMDay')))
  )
  select
    schedule.department_id,
    schedule.department_name,
    schedule.timetable_version_id,
    schedule.timetable_version_number,
    schedule.timetable_title,
    schedule.academic_period_id,
    scheduled.id,
    coalesce(
      nullif(schedule.item ->> 'teachingAllocationId', '')::uuid,
      scheduled.teaching_allocation_id
    ),
    scheduled.cohort_id,
    scheduled.unit_id,
    coalesce(
      nullif(schedule.item ->> 'sessionNumber', '')::integer,
      scheduled.session_number::integer
    ),
    nullif(schedule.item ->> 'startTime', '')::time,
    nullif(schedule.item ->> 'endTime', '')::time,
    coalesce(nullif(schedule.item ->> 'unitCode', ''), unit_record.code),
    coalesce(nullif(schedule.item ->> 'unitName', ''), unit_record.name),
    coalesce(nullif(schedule.item ->> 'cohortName', ''), cohort.name),
    nullif(schedule.item ->> 'roomName', ''),
    coalesce(
      nullif(schedule.item ->> 'deliveryMode', ''),
      scheduled.delivery_mode::text
    )
  from current_schedule schedule
  join public.scheduled_sessions scheduled
    on scheduled.id = nullif(schedule.item ->> 'id', '')::uuid
  join public.units unit_record
    on unit_record.id = scheduled.unit_id
  join public.cohorts cohort
    on cohort.id = scheduled.cohort_id
  where schedule.session_rank = 1
  order by nullif(schedule.item ->> 'startTime', '')::time,
           unit_record.code;
$$;

revoke all
on function public._trainer_daily_schedule_v1(uuid,date)
from public, authenticated;

-- Trainer workspace: submitted snapshot or live current-timetable preview.
create or replace function public.get_trainer_daily_report_workspace(
  target_report_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  trainer_row record;
  report_row record;
  lesson_payload jsonb := '[]'::jsonb;
  incomplete_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select
    trainer.id,
    trainer.full_name,
    trainer.staff_number,
    trainer.department_id,
    department.name as department_name
  into trainer_row
  from public.trainers trainer
  join public.departments department
    on department.id = trainer.department_id
  where trainer.profile_id = auth.uid()
    and trainer.is_active
  order by trainer.created_at
  limit 1;

  if not found then
    raise exception 'Your trainer profile could not be resolved.'
      using errcode = '42501';
  end if;

  select *
  into report_row
  from public.trainer_daily_reports
  where trainer_id = trainer_row.id
    and report_date = target_report_date
    and status = 'submitted'
  limit 1;

  if found then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', lesson.id,
          'departmentId', lesson.department_id,
          'departmentName', lesson.department_name_snapshot,
          'timetableVersionId', lesson.timetable_version_id,
          'timetableVersionNumber', lesson.timetable_version_number,
          'timetableTitle', lesson.timetable_title,
          'scheduledSessionId', lesson.scheduled_session_id,
          'teachingAllocationId', lesson.teaching_allocation_id,
          'academicPeriodId', lesson.academic_period_id,
          'cohortId', lesson.cohort_id,
          'unitId', lesson.unit_id,
          'sessionNumber', lesson.session_number,
          'startsAt', lesson.starts_at,
          'endsAt', lesson.ends_at,
          'unitCode', lesson.unit_code_snapshot,
          'unitName', lesson.unit_name_snapshot,
          'cohortName', lesson.cohort_name_snapshot,
          'roomName', lesson.room_name_snapshot,
          'deliveryMode', lesson.delivery_mode_snapshot,
          'attendanceSessionId', lesson.attendance_session_id,
          'attendanceStatus', 'completed',
          'rosterCount', lesson.roster_count,
          'presentCount', lesson.present_count,
          'absentCount', lesson.absent_count,
          'absentees', lesson.absentees
        )
        order by lesson.starts_at, lesson.unit_code_snapshot
      ),
      '[]'::jsonb
    )
    into lesson_payload
    from public.trainer_daily_report_lessons lesson
    where lesson.report_id = report_row.id;

    return jsonb_build_object(
      'reportDate', report_row.report_date,
      'trainerId', report_row.trainer_id,
      'trainerName', report_row.trainer_name_snapshot,
      'trainerNumber', report_row.trainer_number_snapshot,
      'homeDepartmentId', report_row.home_department_id,
      'homeDepartmentName', report_row.home_department_name_snapshot,
      'status', 'submitted',
      'reportId', report_row.id,
      'submittedAt', report_row.submitted_at,
      'otherActivity', coalesce(report_row.other_activity, ''),
      'concern', coalesce(report_row.concern, ''),
      'readyToSubmit', false,
      'blockingReason', null,
      'lessons', lesson_payload
    );
  end if;

  with schedule as (
    select *
    from public._trainer_daily_schedule_v1(
      trainer_row.id,
      target_report_date
    )
  ),
  enriched as (
    select
      schedule.*,
      attendance.id as attendance_session_id,
      coalesce(attendance.status, 'not_started') as attendance_status,
      coalesce(attendance.roster_count, 0) as roster_count,
      coalesce((
        select count(*)::integer
        from public.class_attendance_entries entry
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'present'
      ), 0) as present_count,
      coalesce((
        select count(*)::integer
        from public.class_attendance_entries entry
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'absent'
      ), 0) as absent_count,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'studentId', student.id,
            'admissionNumber', student.admission_number,
            'fullName', student.full_name,
            'note', entry.note
          )
          order by student.full_name, student.admission_number
        )
        from public.class_attendance_entries entry
        join public.students student on student.id = entry.student_id
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'absent'
      ), '[]'::jsonb) as absentees
    from schedule
    left join lateral (
      select session.id, session.status, session.roster_count
      from public.class_sessions session
      where session.scheduled_session_id = schedule.scheduled_session_id
        and session.session_date = target_report_date
        and session.status <> 'cancelled'
      order by session.updated_at desc
      limit 1
    ) attendance on true
  )
  select
    count(*) filter (where attendance_status <> 'completed')::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', null,
          'departmentId', enriched.department_id,
          'departmentName', enriched.department_name,
          'timetableVersionId', enriched.timetable_version_id,
          'timetableVersionNumber', enriched.timetable_version_number,
          'timetableTitle', enriched.timetable_title,
          'scheduledSessionId', enriched.scheduled_session_id,
          'teachingAllocationId', enriched.teaching_allocation_id,
          'academicPeriodId', enriched.academic_period_id,
          'cohortId', enriched.cohort_id,
          'unitId', enriched.unit_id,
          'sessionNumber', enriched.session_number,
          'startsAt', enriched.starts_at,
          'endsAt', enriched.ends_at,
          'unitCode', enriched.unit_code,
          'unitName', enriched.unit_name,
          'cohortName', enriched.cohort_name,
          'roomName', enriched.room_name,
          'deliveryMode', enriched.delivery_mode,
          'attendanceSessionId', enriched.attendance_session_id,
          'attendanceStatus',
            case
              when enriched.attendance_status = 'completed' then 'completed'
              when enriched.attendance_status = 'open' then 'open'
              else 'not_started'
            end,
          'rosterCount', enriched.roster_count,
          'presentCount', enriched.present_count,
          'absentCount', enriched.absent_count,
          'absentees', enriched.absentees
        )
        order by enriched.starts_at, enriched.unit_code
      ),
      '[]'::jsonb
    )
  into incomplete_count, lesson_payload
  from enriched;

  return jsonb_build_object(
    'reportDate', target_report_date,
    'trainerId', trainer_row.id,
    'trainerName', trainer_row.full_name,
    'trainerNumber', trainer_row.staff_number,
    'homeDepartmentId', trainer_row.department_id,
    'homeDepartmentName', trainer_row.department_name,
    'status', 'draft',
    'reportId', null,
    'submittedAt', null,
    'otherActivity', '',
    'concern', '',
    'readyToSubmit', incomplete_count = 0,
    'blockingReason',
      case
        when incomplete_count > 0
        then 'Complete Class Attendance for every scheduled lesson before submitting the daily report.'
        else null
      end,
    'lessons', lesson_payload
  );
end;
$$;

revoke all
on function public.get_trainer_daily_report_workspace(date)
from public;

grant execute
on function public.get_trainer_daily_report_workspace(date)
to authenticated;

-- Submit one immutable daily snapshot.
create or replace function public.submit_trainer_daily_report(
  target_report_date date,
  target_other_activity text default null,
  target_concern text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trainer_row record;
  new_report_id uuid;
  schedule_count integer := 0;
  incomplete_count integer := 0;
  nairobi_today date :=
    (now() at time zone 'Africa/Nairobi')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if target_report_date is null or target_report_date > nairobi_today then
    raise exception 'A daily report cannot be submitted for a future date.'
      using errcode = '23514';
  end if;

  if char_length(coalesce(target_other_activity, '')) > 800 then
    raise exception 'Other activity is too long.' using errcode = '22001';
  end if;

  if char_length(coalesce(target_concern, '')) > 1200 then
    raise exception 'Concern is too long.' using errcode = '22001';
  end if;

  select
    trainer.id,
    trainer.full_name,
    trainer.staff_number,
    trainer.department_id,
    department.name as department_name
  into trainer_row
  from public.trainers trainer
  join public.departments department
    on department.id = trainer.department_id
  where trainer.profile_id = auth.uid()
    and trainer.is_active
  order by trainer.created_at
  limit 1;

  if not found then
    raise exception 'Your trainer profile could not be resolved.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'trainer-daily-report:' || trainer_row.id::text || ':' ||
      target_report_date::text,
      0
    )
  );

  if exists (
    select 1
    from public.trainer_daily_reports
    where trainer_id = trainer_row.id
      and report_date = target_report_date
      and status = 'submitted'
  ) then
    raise exception 'The daily report for this date has already been submitted.'
      using errcode = '23505';
  end if;

  with schedule as (
    select *
    from public._trainer_daily_schedule_v1(
      trainer_row.id,
      target_report_date
    )
  )
  select
    count(*)::integer,
    count(*) filter (
      where not exists (
        select 1
        from public.class_sessions attendance
        where attendance.scheduled_session_id = schedule.scheduled_session_id
          and attendance.session_date = target_report_date
          and attendance.status = 'completed'
      )
    )::integer
  into schedule_count, incomplete_count
  from schedule;

  if incomplete_count > 0 then
    raise exception
      'Complete Class Attendance for every scheduled lesson before submitting the daily report.'
      using errcode = '23514';
  end if;

  if schedule_count = 0
     and nullif(trim(coalesce(target_other_activity, '')), '') is null
     and nullif(trim(coalesce(target_concern, '')), '') is null
  then
    raise exception
      'There are no scheduled lessons. Add another activity or concern before submitting.'
      using errcode = '23514';
  end if;

  insert into public.trainer_daily_reports (
    trainer_id,
    trainer_profile_id,
    home_department_id,
    trainer_name_snapshot,
    trainer_number_snapshot,
    home_department_name_snapshot,
    report_date,
    other_activity,
    concern,
    status,
    submitted_at
  )
  values (
    trainer_row.id,
    auth.uid(),
    trainer_row.department_id,
    trainer_row.full_name,
    trainer_row.staff_number,
    trainer_row.department_name,
    target_report_date,
    nullif(trim(coalesce(target_other_activity, '')), ''),
    nullif(trim(coalesce(target_concern, '')), ''),
    'submitted',
    now()
  )
  returning id into new_report_id;

  insert into public.trainer_daily_report_lessons (
    report_id,
    department_id,
    department_name_snapshot,
    timetable_version_id,
    timetable_version_number,
    timetable_title,
    scheduled_session_id,
    teaching_allocation_id,
    academic_period_id,
    cohort_id,
    unit_id,
    session_number,
    starts_at,
    ends_at,
    unit_code_snapshot,
    unit_name_snapshot,
    cohort_name_snapshot,
    room_name_snapshot,
    delivery_mode_snapshot,
    attendance_session_id,
    roster_count,
    present_count,
    absent_count,
    absentees
  )
  select
    new_report_id,
    schedule.department_id,
    schedule.department_name,
    schedule.timetable_version_id,
    schedule.timetable_version_number,
    schedule.timetable_title,
    schedule.scheduled_session_id,
    schedule.teaching_allocation_id,
    schedule.academic_period_id,
    schedule.cohort_id,
    schedule.unit_id,
    schedule.session_number,
    schedule.starts_at,
    schedule.ends_at,
    schedule.unit_code,
    schedule.unit_name,
    schedule.cohort_name,
    schedule.room_name,
    schedule.delivery_mode,
    attendance.id,
    attendance.roster_count,
    (
      select count(*)::integer
      from public.class_attendance_entries entry
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'present'
    ),
    (
      select count(*)::integer
      from public.class_attendance_entries entry
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'absent'
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'studentId', student.id,
          'admissionNumber', student.admission_number,
          'fullName', student.full_name,
          'note', entry.note
        )
        order by student.full_name, student.admission_number
      )
      from public.class_attendance_entries entry
      join public.students student on student.id = entry.student_id
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'absent'
    ), '[]'::jsonb)
  from public._trainer_daily_schedule_v1(
    trainer_row.id,
    target_report_date
  ) schedule
  join lateral (
    select session.id, session.roster_count
    from public.class_sessions session
    where session.scheduled_session_id = schedule.scheduled_session_id
      and session.session_date = target_report_date
      and session.status = 'completed'
    order by session.updated_at desc
    limit 1
  ) attendance on true;

  return new_report_id;
end;
$$;

revoke all
on function public.submit_trainer_daily_report(date,text,text)
from public;

grant execute
on function public.submit_trainer_daily_report(date,text,text)
to authenticated;


-- HOD / management workspace.
create or replace function public.get_department_trainer_daily_reports(
  target_report_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_department uuid :=
    public.current_user_primary_department_id();
  active_department_name text;
  expected_count integer := 0;
  submitted_count integer := 0;
  pending_count integer := 0;
  lesson_count integer := 0;
  absence_count integer := 0;
  concern_count integer := 0;
  pending_payload jsonb := '[]'::jsonb;
  reports_payload jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
     or active_department is null
     or not public.current_user_can_manage_department(active_department)
  then
    raise exception
      'Select an authorized department before viewing trainer daily reports.'
      using errcode = '42501';
  end if;

  select name
  into active_department_name
  from public.departments
  where id = active_department;

  with expected as (
    select distinct
      trainer.id as trainer_id,
      trainer.full_name as trainer_name
    from public.trainers trainer
    where trainer.is_active
      and (
        (
          trainer.department_id = active_department
          and exists (
            select 1
            from public._trainer_daily_schedule_v1(
              trainer.id,
              target_report_date
            )
          )
        )
        or exists (
          select 1
          from public._trainer_daily_schedule_v1(
            trainer.id,
            target_report_date
          ) schedule
          where schedule.department_id = active_department
        )
      )
  ),
  submitted as (
    select distinct report.trainer_id
    from public.trainer_daily_reports report
    where report.report_date = target_report_date
      and report.status = 'submitted'
      and (
        report.home_department_id = active_department
        or exists (
          select 1
          from public.trainer_daily_report_lessons lesson
          where lesson.report_id = report.id
            and lesson.department_id = active_department
        )
      )
  )
  select
    (select count(*)::integer from expected),
    (select count(*)::integer from submitted),
    (
      select count(*)::integer
      from expected
      where not exists (
        select 1
        from submitted
        where submitted.trainer_id = expected.trainer_id
      )
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'trainerId', expected.trainer_id,
          'trainerName', expected.trainer_name
        )
        order by expected.trainer_name
      )
      from expected
      where not exists (
        select 1
        from submitted
        where submitted.trainer_id = expected.trainer_id
      )
    ), '[]'::jsonb)
  into expected_count, submitted_count, pending_count, pending_payload;

  select
    count(*)::integer,
    coalesce(sum(lesson.absent_count), 0)::integer
  into lesson_count, absence_count
  from public.trainer_daily_report_lessons lesson
  join public.trainer_daily_reports report
    on report.id = lesson.report_id
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and lesson.department_id = active_department;

  select count(*)::integer
  into concern_count
  from public.trainer_daily_reports report
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and nullif(trim(coalesce(report.concern, '')), '') is not null
    and (
      report.home_department_id = active_department
      or exists (
        select 1
        from public.trainer_daily_report_lessons lesson
        where lesson.report_id = report.id
          and lesson.department_id = active_department
      )
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reportId', report.id,
        'trainerId', report.trainer_id,
        'trainerName', report.trainer_name_snapshot,
        'trainerNumber', report.trainer_number_snapshot,
        'homeDepartmentId', report.home_department_id,
        'homeDepartmentName', report.home_department_name_snapshot,
        'submittedAt', report.submitted_at,
        'otherActivity', coalesce(report.other_activity, ''),
        'concern', coalesce(report.concern, ''),
        'lessons',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', lesson.id,
                'departmentId', lesson.department_id,
                'departmentName', lesson.department_name_snapshot,
                'timetableVersionId', lesson.timetable_version_id,
                'timetableVersionNumber', lesson.timetable_version_number,
                'timetableTitle', lesson.timetable_title,
                'scheduledSessionId', lesson.scheduled_session_id,
                'teachingAllocationId', lesson.teaching_allocation_id,
                'academicPeriodId', lesson.academic_period_id,
                'cohortId', lesson.cohort_id,
                'unitId', lesson.unit_id,
                'sessionNumber', lesson.session_number,
                'startsAt', lesson.starts_at,
                'endsAt', lesson.ends_at,
                'unitCode', lesson.unit_code_snapshot,
                'unitName', lesson.unit_name_snapshot,
                'cohortName', lesson.cohort_name_snapshot,
                'roomName', lesson.room_name_snapshot,
                'deliveryMode', lesson.delivery_mode_snapshot,
                'attendanceSessionId', lesson.attendance_session_id,
                'attendanceStatus', 'completed',
                'rosterCount', lesson.roster_count,
                'presentCount', lesson.present_count,
                'absentCount', lesson.absent_count,
                'absentees', lesson.absentees
              )
              order by lesson.starts_at, lesson.unit_code_snapshot
            )
            from public.trainer_daily_report_lessons lesson
            where lesson.report_id = report.id
              and (
                report.home_department_id = active_department
                or lesson.department_id = active_department
              )
          ), '[]'::jsonb)
      )
      order by report.trainer_name_snapshot
    ),
    '[]'::jsonb
  )
  into reports_payload
  from public.trainer_daily_reports report
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and (
      report.home_department_id = active_department
      or exists (
        select 1
        from public.trainer_daily_report_lessons lesson
        where lesson.report_id = report.id
          and lesson.department_id = active_department
      )
    );

  return jsonb_build_object(
    'reportDate', target_report_date,
    'departmentId', active_department,
    'departmentName', active_department_name,
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'expectedTrainers', expected_count,
      'submittedReports', submitted_count,
      'pendingReports', pending_count,
      'scheduledLessons', lesson_count,
      'recordedAbsences', absence_count,
      'concerns', concern_count
    ),
    'pendingTrainers', pending_payload,
    'reports', reports_payload
  );
end;
$$;

revoke all
on function public.get_department_trainer_daily_reports(date)
from public;

grant execute
on function public.get_department_trainer_daily_reports(date)
to authenticated;

comment on table public.trainer_daily_reports is
  'One brief immutable trainer report per day. Activity and concern are trainer-entered; scheduled lessons and absentee details are system-derived.';

comment on table public.trainer_daily_report_lessons is
  'Submitted lesson snapshots sourced from the current published timetable and completed Class Attendance.';

comment on function public.submit_trainer_daily_report(date,text,text) is
  'Submits one daily trainer report only after all current published-timetable lessons for the date have completed Class Attendance.';

commit;
