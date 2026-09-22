-- Migration: 20260922170000_live_trainer_daily_schedule.sql
-- Purpose:
--   Fix trainer daily-report submission and attendance drift caused by
--   _trainer_daily_schedule_v1 reading trainer/day from the last published
--   timetable_versions.snapshot instead of the live scheduled_sessions rows.
--
-- Behaviour:
--   * Submitted reports remain immutable because get_trainer_daily_report_workspace
--     returns trainer_daily_report_lessons for an already-submitted report.
--   * Today/future draft reports resolve from LIVE scheduled_sessions +
--     working_days + time_slots.
--   * Past draft reports continue using the published snapshot so historical
--     dates are not silently re-projected onto a later timetable.
--   * Moving/reassigning a live session therefore moves it between trainer
--     daily reports immediately, without requiring timetable re-publication.
--   * Attendance remains linked by scheduled_session_id, so the same class
--     attendance record follows the session when its day/trainer changes.

begin;

drop function if exists public._trainer_daily_schedule_v1(uuid, date);

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
  /*
   * Keep historical/unsubmitted dates stable.
   *
   * For today and future dates the authoritative source is the live
   * scheduled_sessions placement.  The timetable snapshot is only metadata
   * (version/title) and is NOT used to decide trainer/day membership.
   */
  with live_schedule as (
    select
      trainer.department_id,
      department.name as department_name,
      scheduled.academic_period_id,
      scheduled.id as scheduled_session_id,
      scheduled.teaching_allocation_id,
      scheduled.cohort_id,
      scheduled.unit_id,
      scheduled.session_number::integer as session_number,
      start_slot.starts_at,
      end_slot.ends_at,
      unit_record.code as unit_code,
      unit_record.name as unit_name,
      coalesce(
        (
          select string_agg(distinct c.name, ' / ' order by c.name)
          from public.cohorts c
          where c.id = any(scheduled.participant_cohort_ids)
        ),
        cohort.name
      ) as cohort_name,
      room.name as room_name,
      scheduled.delivery_mode::text as delivery_mode,
      latest_version.id as timetable_version_id,
      latest_version.version_number as timetable_version_number,
      latest_version.title as timetable_title
    from public.scheduled_sessions scheduled
    join public.trainers trainer
      on trainer.id = scheduled.trainer_id
     and trainer.id = target_trainer_id
     and trainer.is_active = true
    join public.departments department
      on department.id = trainer.department_id
    join public.academic_periods period
      on period.id = scheduled.academic_period_id
     and target_report_date between period.teaching_starts_on
                                and period.teaching_ends_on
    join public.working_days working_day
      on working_day.id = scheduled.working_day_id
     and working_day.academic_period_id = scheduled.academic_period_id
     and working_day.is_enabled = true
     and lower(working_day.day_of_week::text) =
         lower(to_char(target_report_date, 'FMDay'))
    join public.time_slots start_slot
      on start_slot.id = scheduled.start_time_slot_id
     and start_slot.academic_period_id = scheduled.academic_period_id
    join public.time_slots end_slot
      on end_slot.id = scheduled.end_time_slot_id
     and end_slot.academic_period_id = scheduled.academic_period_id
    join public.units unit_record
      on unit_record.id = scheduled.unit_id
    left join public.cohorts cohort
      on cohort.id = scheduled.cohort_id
    left join public.rooms room
      on room.id = scheduled.room_id
    left join lateral (
      select
        version.id,
        version.version_number,
        version.title
      from public.timetable_versions version
      where version.status = 'published'
        and version.department_id = trainer.department_id
        and version.academic_period_id = scheduled.academic_period_id
      order by version.version_number desc
      limit 1
    ) latest_version on true
    where scheduled.status not in ('cancelled', 'archived')
  ),
  historical_schedule as (
    /*
     * Preserve the existing snapshot projection for dates before today.
     * This branch is intentionally unchanged in its source-of-truth rule.
     */
    select
      version.department_id,
      department.name as department_name,
      version.id as timetable_version_id,
      version.version_number as timetable_version_number,
      version.title as timetable_title,
      version.academic_period_id,
      scheduled.id as scheduled_session_id,
      coalesce(
        nullif(item ->> 'teachingAllocationId', '')::uuid,
        scheduled.teaching_allocation_id
      ) as teaching_allocation_id,
      scheduled.cohort_id,
      scheduled.unit_id,
      coalesce(
        nullif(item ->> 'sessionNumber', '')::integer,
        scheduled.session_number::integer
      ) as session_number,
      nullif(item ->> 'startTime', '')::time as starts_at,
      nullif(item ->> 'endTime', '')::time as ends_at,
      coalesce(nullif(item ->> 'unitCode', ''), unit_record.code) as unit_code,
      coalesce(nullif(item ->> 'unitName', ''), unit_record.name) as unit_name,
      coalesce(
        (
          select string_agg(distinct c.name, ' / ' order by c.name)
          from public.cohorts c
          where c.id = any(scheduled.participant_cohort_ids)
        ),
        nullif(item ->> 'cohortName', ''),
        cohort.name
      ) as cohort_name,
      nullif(item ->> 'roomName', '') as room_name,
      coalesce(
        nullif(item ->> 'deliveryMode', ''),
        scheduled.delivery_mode::text
      ) as delivery_mode,
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
    join public.scheduled_sessions scheduled
      on scheduled.id = nullif(item ->> 'id', '')::uuid
    join public.units unit_record
      on unit_record.id = scheduled.unit_id
    left join public.cohorts cohort
      on cohort.id = scheduled.cohort_id
    where version.status = 'published'
      and target_report_date between period.teaching_starts_on
                                 and period.teaching_ends_on
      and nullif(item ->> 'trainerId', '')::uuid = target_trainer_id
      and lower(trim(item ->> 'day')) =
          lower(trim(to_char(target_report_date, 'FMDay')))
      and scheduled.status not in ('cancelled', 'archived')
  ),
  selected as (
    select
      l.department_id,
      l.department_name,
      l.timetable_version_id,
      l.timetable_version_number,
      l.timetable_title,
      l.academic_period_id,
      l.scheduled_session_id,
      l.teaching_allocation_id,
      l.cohort_id,
      l.unit_id,
      l.session_number,
      l.starts_at,
      l.ends_at,
      l.unit_code,
      l.unit_name,
      l.cohort_name,
      l.room_name,
      l.delivery_mode
    from live_schedule l
    where target_report_date >=
      (now() at time zone 'Africa/Nairobi')::date

    union all

    select
      h.department_id,
      h.department_name,
      h.timetable_version_id,
      h.timetable_version_number,
      h.timetable_title,
      h.academic_period_id,
      h.scheduled_session_id,
      h.teaching_allocation_id,
      h.cohort_id,
      h.unit_id,
      h.session_number,
      h.starts_at,
      h.ends_at,
      h.unit_code,
      h.unit_name,
      h.cohort_name,
      h.room_name,
      h.delivery_mode
    from historical_schedule h
    where target_report_date <
      (now() at time zone 'Africa/Nairobi')::date
      and h.session_rank = 1
  )
  select *
  from selected
  order by starts_at, unit_code, scheduled_session_id;
$$;

revoke all
  on function public._trainer_daily_schedule_v1(uuid, date)
  from public;

grant execute
  on function public._trainer_daily_schedule_v1(uuid, date)
  to authenticated;

comment on function public._trainer_daily_schedule_v1(uuid, date) is
  'Resolves today/future trainer schedules from live scheduled_sessions; preserves published snapshots for past dates.';

commit;
