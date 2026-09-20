-- Migration: 20260920150000_resilient_class_attendance_pipeline.sql
-- Description:
--   1. Restores visibility for all recorded trainer class attendance (including sessions under draft/suspended allocations and shared classes).
--   2. Decouples class_sessions from strict ephemeral scheduled_sessions(id) via ON DELETE SET NULL and nullable scheduled_session_id.
--   3. Upgrades current_user_can_access_class_session and trainer_can_access_allocation to prevent RLS blindspots.
--   4. Upgrades get_staff_class_attendance_history and get_department_class_attendance_overview with multi-cohort names and service unit support.
--   5. Enhances open_class_attendance_session to reconnect to existing attendance sessions and fall back to timetable snapshots.
--   6. Hardens unschedule_session_safely and save_generated_timetable_draft to detach and reconcile attendance instead of failing or blocking.
--   7. Fixes _trainer_daily_schedule_v1 with LEFT JOIN so published snapshots always display sessions.
--   8. Runs a one-off reconciliation repair to re-link all existing attendance sessions.

begin;

-- ============================================================================
-- 1. Decouple class_sessions.scheduled_session_id from ON DELETE RESTRICT
-- ============================================================================

-- Drop the restrictive foreign key on scheduled_sessions if it exists
do $$
declare
  fk_record record;
begin
  for fk_record in
    select conname
    from pg_constraint
    where conrelid = 'public.class_sessions'::regclass
      and contype = 'f'
      and confrelid = 'public.scheduled_sessions'::regclass
  loop
    execute format('alter table public.class_sessions drop constraint %I', fk_record.conname);
  end loop;
end $$;

-- Allow scheduled_session_id to be NULL so historical attendance survives timetable adjustments
alter table public.class_sessions
  alter column scheduled_session_id drop not null;

-- Re-add foreign key with ON DELETE SET NULL
alter table public.class_sessions
  add constraint class_sessions_scheduled_session_id_fkey
  foreign key (scheduled_session_id)
  references public.scheduled_sessions(id)
  on delete set null;

-- Drop old unique index that required scheduled_session_id
drop index if exists public.class_sessions_schedule_date_unique_idx;

create unique index if not exists class_sessions_schedule_date_unique_idx
on public.class_sessions (
  scheduled_session_id,
  session_date
)
where scheduled_session_id is not null and status <> 'cancelled';

-- Add semantic deduplication index on allocation, date, and start time
create unique index if not exists class_sessions_semantic_unique_idx
on public.class_sessions (
  teaching_allocation_id,
  session_date,
  starts_at
)
where status <> 'cancelled';


-- ============================================================================
-- 2. Upgrade trainer_can_access_allocation: Allow Draft, Active, Completed & Suspended
-- ============================================================================

create or replace function public.trainer_can_access_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.teaching_allocations as allocation
    where allocation.id = target_allocation_id
      and (
        allocation.trainer_id = public.current_trainer_id()
        or exists (
          select 1
          from public.teaching_allocations as partner
          where partner.teaching_offering_id is not null
            and partner.teaching_offering_id = allocation.teaching_offering_id
            and partner.trainer_id = public.current_trainer_id()
        )
      )
      and allocation.status::text in (
        'draft',
        'active',
        'completed',
        'suspended'
      )
  );
$$;

revoke all on function public.trainer_can_access_allocation(uuid) from public;
grant execute on function public.trainer_can_access_allocation(uuid) to authenticated;

comment on function public.trainer_can_access_allocation(uuid) is
  'Evaluates whether the authenticated trainer has access to a teaching allocation (including draft/suspended allocations and shared-offering partners).';


-- ============================================================================
-- 3. Upgrade current_user_can_access_class_session: Full RLS Accessibility
-- ============================================================================

create or replace function public.current_user_can_access_class_session(
  target_class_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.class_sessions as session
    left join public.cohorts as cohort
      on cohort.id = session.cohort_id
    left join public.programmes as programme
      on programme.id = cohort.programme_id
    left join public.units as unit
      on unit.id = session.unit_id
    where session.id = target_class_session_id
      and (
        -- System Admin role
        public.current_user_has_role(array['system_admin']::public.app_role[])
        -- HOD of programme department
        or (programme.department_id is not null and public.current_user_can_manage_department(programme.department_id))
        -- HOD of unit department (service units)
        or (unit.department_id is not null and public.current_user_can_manage_department(unit.department_id))
        -- HOD of the allocation department
        or exists (
          select 1 from public.teaching_allocations ta
          join public.cohorts tc on tc.id = ta.cohort_id
          join public.programmes tp on tp.id = tc.programme_id
          where ta.id = session.teaching_allocation_id
            and public.current_user_can_manage_department(tp.department_id)
        )
        -- The trainer directly assigned to this session
        or (session.trainer_id is not null and session.trainer_id = public.current_trainer_id())
        -- The user who opened, updated, or completed this session
        or session.opened_by = auth.uid()
        or session.completed_by = auth.uid()
        -- The trainer having access to the underlying teaching allocation
        or public.trainer_can_access_allocation(session.teaching_allocation_id)
      )
  );
$$;

revoke all on function public.current_user_can_access_class_session(uuid) from public;
grant execute on function public.current_user_can_access_class_session(uuid) to authenticated;

comment on function public.current_user_can_access_class_session(uuid) is
  'Defines authoritative RLS access for a class session. Ensures trainers always retain access to their recorded sessions and HODs retain departmental oversight.';


-- ============================================================================
-- 4. Upgrade get_staff_class_attendance_history: Complete Trainer Attendance Log
-- ============================================================================

drop function if exists public.get_staff_class_attendance_history(integer);
drop function if exists public.get_staff_class_attendance_history();

create or replace function public.get_staff_class_attendance_history(
  target_limit integer default 30
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  session_date date,
  status text,
  unit_name text,
  cohort_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  present_count integer,
  absent_count integer,
  unmarked_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    coalesce(unit.name, 'Unit'),
    coalesce(
      (
        select string_agg(distinct c.name, ' / ' order by c.name)
        from public.scheduled_sessions ss
        join public.cohorts c on c.id = any(ss.participant_cohort_ids)
        where ss.id = session.scheduled_session_id
      ),
      cohort.name,
      'Cohort'
    ),
    session.starts_at,
    session.ends_at,
    session.roster_count,
    count(entry.id) filter (
      where entry.attendance_status = 'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'absent'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status in ('unmarked', 'not_reported')
    )::integer
  from public.class_sessions as session
  left join public.units as unit
    on unit.id = session.unit_id
  left join public.cohorts as cohort
    on cohort.id = session.cohort_id
  left join public.class_attendance_entries as entry
    on entry.class_session_id = session.id
  where (
    session.trainer_id = public.current_trainer_id()
    or session.opened_by = auth.uid()
    or public.trainer_can_access_allocation(session.teaching_allocation_id)
  )
  group by
    session.id,
    session.scheduled_session_id,
    unit.name,
    cohort.name
  order by
    session.session_date desc,
    session.starts_at desc
  limit greatest(
    1,
    least(
      coalesce(target_limit, 30),
      200
    )
  );
$$;

revoke all on function public.get_staff_class_attendance_history(integer) from public;
grant execute on function public.get_staff_class_attendance_history(integer) to authenticated;

comment on function public.get_staff_class_attendance_history(integer) is
  'Returns all class attendance history recorded by or assigned to the current trainer with composite cohort names and exception visibility.';


-- ============================================================================
-- 5. Upgrade get_department_class_attendance_overview: Full HOD & Service Unit Scope
-- ============================================================================

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
  is_sysadmin boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'Attendance oversight is limited to HOD and system administrator roles.' using errcode = '42501';
  end if;

  active_department := public.current_user_primary_department_id();
  is_sysadmin := public.current_user_has_role(array['system_admin']::public.app_role[]);

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    coalesce(
      (
        select string_agg(distinct c.name, ' / ' order by c.name)
        from public.scheduled_sessions ss
        join public.cohorts c on c.id = any(ss.participant_cohort_ids)
        where ss.id = session.scheduled_session_id
      ),
      cohort.name,
      'Cohort'
    ),
    coalesce(trainer.full_name, 'UNASSIGNED'),
    session.starts_at,
    session.ends_at,
    session.roster_count,
    count(entry.id) filter (
      where entry.attendance_status = 'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status = 'absent'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status in ('unmarked', 'not_reported')
    )::integer,
    session.opened_at,
    session.completed_at
  from public.class_sessions as session
  join public.academic_periods as period
    on period.id = session.academic_period_id
  join public.units as unit
    on unit.id = session.unit_id
  join public.cohorts as cohort
    on cohort.id = session.cohort_id
  join public.programmes as programme
    on programme.id = cohort.programme_id
  left join public.trainers as trainer
    on trainer.id = session.trainer_id
  left join public.class_attendance_entries as entry
    on entry.class_session_id = session.id
  where (
    is_sysadmin
    or unit.department_id = active_department
    or programme.department_id = active_department
    or exists (
      select 1 from public.teaching_allocations ta
      join public.cohorts c on c.id = ta.cohort_id
      join public.programmes p on p.id = c.programme_id
      where ta.id = session.teaching_allocation_id
        and p.department_id = active_department
    )
  )
  group by
    session.id,
    session.scheduled_session_id,
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
      coalesce(target_limit, 100),
      500
    )
  );
end;
$$;

revoke all on function public.get_department_class_attendance_overview(integer) from public;
grant execute on function public.get_department_class_attendance_overview(integer) to authenticated;

comment on function public.get_department_class_attendance_overview(integer) is
  'Provides HOD oversight across all department-associated class attendance records, including service units and composite shared classes.';


-- ============================================================================
-- 6. Helper: Reconcile Detached Attendance Sessions to Live Timetable
-- ============================================================================

drop function if exists public.reconcile_attendance_to_scheduled_sessions(uuid);

create or replace function public.reconcile_attendance_to_scheduled_sessions(
  target_academic_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  relinked_count integer := 0;
begin
  -- Re-link class_sessions where scheduled_session_id is null or no longer exists
  with candidate_matches as (
    select distinct on (cs.id)
      cs.id as class_session_id,
      ss.id as live_session_id
    from public.class_sessions cs
    join public.scheduled_sessions ss
      on ss.academic_period_id = cs.academic_period_id
     and (
       ss.teaching_allocation_id = cs.teaching_allocation_id
       or (ss.unit_id = cs.unit_id and ss.cohort_id = cs.cohort_id)
     )
    join public.working_days wd on wd.id = ss.working_day_id
    join public.time_slots ts on ts.id = ss.start_time_slot_id
    where cs.academic_period_id = target_academic_period_id
      and (
        cs.scheduled_session_id is null
        or not exists (select 1 from public.scheduled_sessions s2 where s2.id = cs.scheduled_session_id)
      )
      and lower(wd.day_of_week::text) = lower(to_char(cs.session_date, 'FMDay'))
      and not exists (
        select 1
        from public.class_sessions existing_cs
        where existing_cs.scheduled_session_id = ss.id
          and existing_cs.session_date = cs.session_date
          and existing_cs.status <> 'cancelled'
          and existing_cs.id <> cs.id
      )
    order by cs.id, (case when ts.starts_at = cs.starts_at then 0 else 1 end)
  ),
  updated as (
    update public.class_sessions cs
    set scheduled_session_id = cm.live_session_id,
        updated_at = now()
    from candidate_matches cm
    where cs.id = cm.class_session_id
    returning cs.id
  )
  select count(*) into relinked_count from updated;

  return relinked_count;
end;
$$;

revoke all on function public.reconcile_attendance_to_scheduled_sessions(uuid) from public;
grant execute on function public.reconcile_attendance_to_scheduled_sessions(uuid) to authenticated;

comment on function public.reconcile_attendance_to_scheduled_sessions(uuid) is
  'Re-links unattached or drifted class_sessions to their active timetable scheduled_sessions.';


-- ============================================================================
-- 7. Upgrade open_class_attendance_session: Reconnecting & Resilient
-- ============================================================================

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
  existing_session_id uuid;
  new_session_id uuid;
  roster_total integer;
  related_unit_ids uuid[];
  resolved_session_id uuid := target_scheduled_session_id;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if target_session_date is null then
    raise exception 'Class date is required.' using errcode = '22023';
  end if;

  -- 1. Try finding live scheduled session
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

  -- 2. Fallback: Lookup in published timetable versions snapshot if not in live table
  if schedule_row.id is null then
    select
      (item ->> 'id')::uuid as id,
      version.academic_period_id,
      coalesce(nullif(item ->> 'teachingAllocationId', '')::uuid, ta.id) as teaching_allocation_id,
      (item ->> 'cohortId')::uuid as cohort_id,
      case
        when jsonb_typeof(item -> 'participantCohortIds') = 'array' then
          (select array_agg(value::text::uuid) from jsonb_array_elements_text(item -> 'participantCohortIds'))
        else array[(item ->> 'cohortId')::uuid]
      end as participant_cohort_ids,
      (item ->> 'unitId')::uuid as unit_id,
      coalesce(nullif(item ->> 'trainerId', '')::uuid, ta.trainer_id) as trainer_id,
      nullif(item ->> 'roomId', '')::uuid as room_id,
      'locked' as schedule_status,
      (item ->> 'day')::text as day_of_week,
      coalesce(nullif(item ->> 'startTime', '')::time, '08:00:00'::time) as starts_at,
      coalesce(nullif(item ->> 'endTime', '')::time, '10:00:00'::time) as ends_at,
      period.teaching_starts_on,
      period.teaching_ends_on
    into schedule_row
    from public.timetable_versions version
    join public.academic_periods period on period.id = version.academic_period_id
    cross join lateral jsonb_array_elements(version.snapshot) item
    left join public.teaching_allocations ta
      on ta.academic_period_id = version.academic_period_id
     and ta.unit_id = (item ->> 'unitId')::uuid
     and ta.cohort_id = (item ->> 'cohortId')::uuid
    where version.status = 'published'
      and item ->> 'id' = target_scheduled_session_id::text
    order by version.version_number desc
    limit 1;
  end if;

  if schedule_row.id is null then
    raise exception 'Published timetable session was not found.' using errcode = 'P0002';
  end if;

  -- 3. Lock session if live record exists and is not locked
  if schedule_row.schedule_status <> 'locked' and exists (select 1 from public.scheduled_sessions where id = target_scheduled_session_id) then
    update public.scheduled_sessions
    set status = 'locked', is_locked = true, updated_at = now()
    where id = target_scheduled_session_id;
  end if;

  -- 4. Check trainer access (or assigned trainer match)
  if schedule_row.trainer_id is distinct from public.current_trainer_id()
     and not public.trainer_can_access_allocation(schedule_row.teaching_allocation_id)
     and not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'This class is outside your Teaching Allocations.' using errcode = '42501';
  end if;

  -- 5. Discover related equivalent unit IDs
  with shared_offering as (
    select ta.teaching_offering_id as shared_id
    from public.teaching_allocations ta
    where ta.id = schedule_row.teaching_allocation_id
      and ta.teaching_offering_id is not null
    union
    select uo.confirmed_shared_offering_id as shared_id
    from public.unit_offerings uo
    where uo.academic_period_id = schedule_row.academic_period_id
      and uo.unit_id = schedule_row.unit_id
      and uo.confirmed_shared_offering_id is not null
  ),
  discovered_units as (
    select schedule_row.unit_id as unit_id
    union
    select uo.unit_id
    from public.unit_offerings uo
    join shared_offering so on so.shared_id = uo.confirmed_shared_offering_id
    where uo.academic_period_id = schedule_row.academic_period_id
    union
    select u2.id as unit_id
    from public.units u1
    join public.units u2
      on lower(trim(u1.name)) = lower(trim(u2.name))
    join public.unit_offerings uo
      on uo.unit_id = u2.id
     and uo.academic_period_id = schedule_row.academic_period_id
     and uo.cohort_id = any(
       array_cat(
         case when schedule_row.cohort_id is not null then array[schedule_row.cohort_id] else array[]::uuid[] end,
         coalesce(schedule_row.participant_cohort_ids, array[]::uuid[])
       )
     )
    where u1.id = schedule_row.unit_id
  )
  select array_agg(distinct unit_id)
  into related_unit_ids
  from discovered_units;

  if related_unit_ids is null or array_length(related_unit_ids, 1) = 0 then
    related_unit_ids := array[schedule_row.unit_id];
  end if;

  -- 6. Check existing active session (by scheduled_session_id OR by allocation+date+time slot)
  select session.id
  into existing_session_id
  from public.class_sessions as session
  where (
    session.scheduled_session_id = target_scheduled_session_id
    or (
      session.teaching_allocation_id = schedule_row.teaching_allocation_id
      and session.session_date = target_session_date
      and session.starts_at = schedule_row.starts_at
    )
  )
  and session.status <> 'cancelled'
  order by (case when session.scheduled_session_id = target_scheduled_session_id then 0 else 1 end)
  limit 1;

  if existing_session_id is not null then
    -- Reconnect scheduled_session_id if it was null or drifted
    update public.class_sessions
    set scheduled_session_id = target_scheduled_session_id,
        updated_at = now()
    where id = existing_session_id
      and (scheduled_session_id is null or scheduled_session_id <> target_scheduled_session_id);

    -- Ensure registered students across equivalent shared units are seeded
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
      and reg.unit_id = any(related_unit_ids)
      and reg.registration_status::text = 'registered'
    on conflict (class_session_id, student_id) do nothing;

    return existing_session_id;
  end if;

  -- 7. Create new attendance session
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
    roster_count,
    opened_by,
    opened_at
  ) values (
    schedule_row.academic_period_id,
    schedule_row.teaching_allocation_id,
    target_scheduled_session_id,
    schedule_row.cohort_id,
    schedule_row.unit_id,
    coalesce(schedule_row.trainer_id, public.current_trainer_id()),
    target_session_date,
    schedule_row.starts_at,
    schedule_row.ends_at,
    schedule_row.room_id,
    'open',
    0,
    auth.uid(),
    now()
  ) returning id into new_session_id;

  -- 8. Seed attendance entries
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
    and reg.unit_id = any(related_unit_ids)
    and reg.registration_status::text = 'registered'
  on conflict (class_session_id, student_id) do nothing;

  select count(*) into roster_total
  from public.class_attendance_entries
  where class_session_id = new_session_id;

  update public.class_sessions
  set roster_count = roster_total
  where id = new_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    from_status,
    to_status,
    note,
    created_by
  ) values (
    new_session_id,
    'opened',
    null,
    'open',
    'Class attendance session opened with registered student roster.',
    auth.uid()
  );

  return new_session_id;
end;
$$;

revoke all on function public.open_class_attendance_session(uuid, date) from public;
grant execute on function public.open_class_attendance_session(uuid, date) to authenticated;

comment on function public.open_class_attendance_session(uuid, date) is
  'Opens or reconnects to an attendance session for a scheduled class, resilient to timetable shifts.';


-- ============================================================================
-- 8. Upgrade unschedule_session_safely: Non-Destructive Detach
-- ============================================================================

create or replace function public.unschedule_session_safely(
  target_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_session public.scheduled_sessions%rowtype;
  active_department uuid := public.current_user_primary_department_id();
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to unschedule sessions.';
  end if;

  select s.* into selected_session
  from public.scheduled_sessions s
  join public.cohorts c on c.id = s.cohort_id
  join public.programmes p on p.id = c.programme_id
  where s.id = target_session_id
    and (active_department is null or p.department_id = active_department)
  for update;

  if selected_session.id is null then
    raise exception using errcode = 'P0002', message = 'The scheduled session was not found.';
  end if;

  -- Non-destructive: detach existing class attendance records rather than aborting
  update public.class_sessions
  set scheduled_session_id = null,
      updated_at = now()
  where scheduled_session_id = target_session_id;

  delete from public.scheduled_sessions where id = selected_session.id;
end;
$$;

revoke all on function public.unschedule_session_safely(uuid) from public;
grant execute on function public.unschedule_session_safely(uuid) to authenticated;

comment on function public.unschedule_session_safely(uuid) is
  'Safely unschedules a timetable session while permanently preserving all recorded class attendance.';


-- ============================================================================
-- 9. Upgrade save_generated_timetable_draft: Safe Detach & Auto-Reconcile
-- ============================================================================

drop function if exists public.save_generated_timetable_draft(uuid, jsonb, jsonb);
drop function if exists public.save_generated_timetable_draft(uuid, jsonb);

create or replace function public.save_generated_timetable_draft(
  target_academic_period_id uuid,
  generated_sessions jsonb,
  generation_summary jsonb default '{}'::jsonb
)
returns table (
  generation_run_id uuid,
  saved_session_count integer,
  locked_session_count integer,
  unscheduled_session_count integer
)
language plpgsql security definer set search_path = '' as $$
declare
  session_item jsonb;
  run_id uuid;
  active_department uuid := public.current_user_primary_department_id();
  saved_total integer := 0;
  locked_total integer := 0;
  unscheduled_total integer :=
    coalesce((generation_summary ->> 'unscheduledSessionCount')::integer, 0);
  requested_total integer :=
    coalesce((generation_summary ->> 'requestedSessionCount')::integer, 0);
  conflict_total integer :=
    coalesce((generation_summary ->> 'conflictCount')::integer, 0);
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before generating.';
  end if;
  if jsonb_typeof(generated_sessions) <> 'array' then
    raise exception using errcode = '22023',
      message = 'Generated sessions must be supplied as a JSON array.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-generation:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  -- Detach any class_sessions from unlocked sessions being removed so attendance is never lost
  update public.class_sessions cs
  set scheduled_session_id = null,
      updated_at = now()
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where cs.scheduled_session_id = session.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked = false or session.status in ('draft', 'confirmed', 'cancelled'));

  -- Delete any orphaned/suspended sessions for this department so they never persist as ghost clashes
  delete from public.scheduled_sessions session
  using public.teaching_allocations allocation, public.cohorts cohort, public.programmes programme
  where session.teaching_allocation_id = allocation.id
    and session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (allocation.status in ('suspended', 'archived') or not allocation.is_timetable_enabled or session.status = 'cancelled');

  select count(*) into locked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked or session.status = 'locked');

  delete from public.scheduled_sessions session
  using public.cohorts cohort, public.programmes programme
  where session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.is_locked = false
    and session.status in ('draft', 'confirmed', 'cancelled');

  for session_item in select value from jsonb_array_elements(generated_sessions)
  loop
    if coalesce((session_item ->> 'isLocked')::boolean, false) then
      continue;
    end if;

    if not exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id =
          (session_item ->> 'teachingAllocationId')::uuid
        and allocation.academic_period_id = target_academic_period_id
        and programme.department_id = active_department
    ) then
      raise exception using errcode = '42501',
        message = 'A generated session belongs to another department.';
    end if;

    insert into public.scheduled_sessions (
      academic_period_id, teaching_allocation_id, cohort_id, unit_id,
      trainer_id, working_day_id, start_time_slot_id, end_time_slot_id,
      room_id, session_number, delivery_mode, status, source,
      conflict_state, is_locked, notes, created_by, updated_by
    ) values (
      target_academic_period_id,
      (session_item ->> 'teachingAllocationId')::uuid,
      (session_item ->> 'cohortId')::uuid,
      (session_item ->> 'unitId')::uuid,
      (session_item ->> 'trainerId')::uuid,
      (session_item ->> 'workingDayId')::uuid,
      (session_item ->> 'startTimeSlotId')::uuid,
      (session_item ->> 'endTimeSlotId')::uuid,
      (session_item ->> 'roomId')::uuid,
      (session_item ->> 'sessionNumber')::smallint,
      (session_item ->> 'deliveryMode')::public.teaching_delivery_mode,
      'draft'::public.scheduled_session_status,
      'generator'::public.scheduled_session_source,
      'clear'::public.scheduled_session_conflict_state,
      false,
      'Generated by the institutional timetabler.',
      auth.uid(),
      auth.uid()
    );
    saved_total := saved_total + 1;
  end loop;

  -- Automatically reconcile any detached class_sessions to the new scheduled sessions
  perform public.reconcile_attendance_to_scheduled_sessions(target_academic_period_id);

  insert into public.timetable_generation_runs (
    academic_period_id, department_id, requested_session_count,
    scheduled_session_count, unscheduled_session_count, conflict_count,
    generation_summary, created_by
  ) values (
    target_academic_period_id, active_department, requested_total,
    saved_total, unscheduled_total, conflict_total,
    generation_summary, auth.uid()
  ) returning id into run_id;

  return query select run_id, saved_total, locked_total, unscheduled_total;
end;
$$;

revoke all on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) from public;
grant execute on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) to authenticated;

comment on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) is
  'Saves generated timetable draft sessions while preserving and reconciling all existing class attendance.';


-- ============================================================================
-- 10. Upgrade _trainer_daily_schedule_v1: LEFT JOIN on scheduled_sessions
-- ============================================================================

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
    coalesce(scheduled.id, nullif(schedule.item ->> 'id', '')::uuid),
    coalesce(
      scheduled.teaching_allocation_id,
      nullif(schedule.item ->> 'teachingAllocationId', '')::uuid,
      (
        select ta.id from public.teaching_allocations ta
        where ta.academic_period_id = schedule.academic_period_id
          and ta.unit_id = coalesce(scheduled.unit_id, nullif(schedule.item ->> 'unitId', '')::uuid)
          and ta.cohort_id = coalesce(scheduled.cohort_id, nullif(schedule.item ->> 'cohortId', '')::uuid)
        limit 1
      )
    ),
    coalesce(scheduled.cohort_id, nullif(schedule.item ->> 'cohortId', '')::uuid),
    coalesce(scheduled.unit_id, nullif(schedule.item ->> 'unitId', '')::uuid),
    coalesce(
      nullif(schedule.item ->> 'sessionNumber', '')::integer,
      scheduled.session_number::integer,
      1
    ),
    coalesce(
      nullif(schedule.item ->> 'startTime', '')::time,
      '08:00:00'::time
    ),
    coalesce(
      nullif(schedule.item ->> 'endTime', '')::time,
      '10:00:00'::time
    ),
    coalesce(nullif(schedule.item ->> 'unitCode', ''), unit_record.code, 'Unit'),
    coalesce(nullif(schedule.item ->> 'unitName', ''), unit_record.name, 'Unit'),
    coalesce(
      (
        select string_agg(distinct c.name, ' / ' order by c.name)
        from public.cohorts c
        where scheduled.participant_cohort_ids is not null
          and c.id = any(scheduled.participant_cohort_ids)
      ),
      nullif(schedule.item ->> 'cohortName', ''),
      cohort.name,
      'Cohort'
    ),
    nullif(schedule.item ->> 'roomName', ''),
    coalesce(
      nullif(schedule.item ->> 'deliveryMode', ''),
      scheduled.delivery_mode::text,
      'lecture'
    )
  from current_schedule schedule
  left join public.scheduled_sessions scheduled
    on scheduled.id = nullif(schedule.item ->> 'id', '')::uuid
  left join public.units unit_record
    on unit_record.id = coalesce(scheduled.unit_id, nullif(schedule.item ->> 'unitId', '')::uuid)
  left join public.cohorts cohort
    on cohort.id = coalesce(scheduled.cohort_id, nullif(schedule.item ->> 'cohortId', '')::uuid)
  where schedule.session_rank = 1
  order by
    nullif(schedule.item ->> 'startTime', '')::time,
    scheduled.session_number;
$$;

revoke all on function public._trainer_daily_schedule_v1(uuid, date) from public;
grant execute on function public._trainer_daily_schedule_v1(uuid, date) to authenticated;

comment on function public._trainer_daily_schedule_v1(uuid, date) is
  'Resolves daily teaching schedule using published timetable version snapshots with resilient scheduled_sessions fallback.';


-- ============================================================================
-- 11. One-Off Data Repair: Re-link All Historical Class Sessions
-- ============================================================================

-- Repair A: If any class_session has a teaching_allocation_id that was retired/suspended,
-- point it to the active allocation for the same unit, cohort, and academic period
update public.class_sessions cs
set teaching_allocation_id = active_ta.id,
    updated_at = now()
from public.teaching_allocations suspended_ta
join public.teaching_allocations active_ta
  on active_ta.academic_period_id = suspended_ta.academic_period_id
 and active_ta.unit_id = suspended_ta.unit_id
 and active_ta.cohort_id = suspended_ta.cohort_id
 and active_ta.status in ('active', 'draft')
 and active_ta.is_timetable_enabled = true
where cs.teaching_allocation_id = suspended_ta.id
  and suspended_ta.status = 'suspended'
  and not exists (
    select 1 from public.class_sessions existing
    where existing.teaching_allocation_id = active_ta.id
      and existing.session_date = cs.session_date
      and existing.starts_at = cs.starts_at
      and existing.status <> 'cancelled'
  );

-- Repair B: If trainer_id on class_sessions is missing or mismatched, align with allocation trainer
update public.class_sessions cs
set trainer_id = ta.trainer_id,
    updated_at = now()
from public.teaching_allocations ta
where cs.teaching_allocation_id = ta.id
  and cs.trainer_id is null
  and ta.trainer_id is not null;

-- Repair C: Reconcile all unlinked scheduled_session_ids across all active academic periods
do $$
declare
  period_row record;
begin
  for period_row in select id from public.academic_periods loop
    perform public.reconcile_attendance_to_scheduled_sessions(period_row.id);
  end loop;
end $$;

commit;
