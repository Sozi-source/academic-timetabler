-- Enterprise Next-Semester Preparation, Shared-Class Consolidation,
-- Fixed-Slot Trainer Ergonomics, and Date-Scoped Calendar Events.
-- Additive and backward-compatible: never modifies active/historical periods.

begin;

-- ============================================================
-- 1. Target-Period Cohort Stage Computation
-- ============================================================

create or replace function public.compute_cohort_stage_for_period(
  p_intake_date date,
  p_period_starts_on date,
  p_total_periods integer default null
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_intake_term integer;
  v_period_term integer;
  v_stage integer;
begin
  if p_intake_date is null or p_period_starts_on is null then
    return null;
  end if;

  v_intake_term := extract(year from p_intake_date)::integer * 3
    + ((extract(month from p_intake_date)::integer - 1) / 4);
  v_period_term := extract(year from p_period_starts_on)::integer * 3
    + ((extract(month from p_period_starts_on)::integer - 1) / 4);

  v_stage := v_period_term - v_intake_term + 1;

  if v_stage < 1 then
    return null;
  end if;

  if p_total_periods is not null and p_total_periods > 0 and v_stage > p_total_periods then
    return null;
  end if;

  return v_stage;
end;
$$;

revoke all on function public.compute_cohort_stage_for_period(date, date, integer) from public;
grant execute on function public.compute_cohort_stage_for_period(date, date, integer) to authenticated;

comment on function public.compute_cohort_stage_for_period(date, date, integer) is
  'Computes 1-indexed 4-month academic term stage for a cohort relative to a target academic period without mutating active cohort staging.';

-- ============================================================
-- 2. Equivalence-Aware Shared-Class Confirmation & Auto-Merge
-- ============================================================

create or replace function public.confirm_shared_unit_offerings(
  p_offering_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_input_count integer;
  v_count integer;
  v_period_count integer;
  v_department_count integer;
  v_title_count integer;
  v_duration_count integer;
  v_existing_group_count integer;
  v_max_weekly_sessions smallint;
  v_session_duration smallint;
  v_period uuid;
  v_department uuid;
  v_title text;
  v_group uuid;
  v_key text;
  v_target_offering_ids uuid[];
begin
  if p_offering_ids is null or cardinality(p_offering_ids) < 2 then
    raise exception 'Select at least two matching units';
  end if;

  select
    count(*),
    count(distinct offering.confirmed_shared_offering_id),
    (
      array_agg(offering.confirmed_shared_offering_id)
      filter (where offering.confirmed_shared_offering_id is not null)
    )[1]
  into
    v_input_count,
    v_existing_group_count,
    v_group
  from public.unit_offerings offering
  where offering.id = any(p_offering_ids)
    and offering.allocation_status = 'unallocated';

  if v_input_count <> cardinality(p_offering_ids) then
    raise exception 'One or more selected units are unavailable or already allocated';
  end if;

  if v_existing_group_count > 1 then
    raise exception 'Units from two different confirmed shared classes cannot be merged';
  end if;

  if v_group is null then
    v_target_offering_ids := p_offering_ids;
  else
    select array_agg(offering.id order by offering.id)
    into v_target_offering_ids
    from public.unit_offerings offering
    where offering.confirmed_shared_offering_id = v_group
      or offering.id = any(p_offering_ids);
  end if;

  perform 1
  from public.unit_offerings offering
  where offering.id = any(v_target_offering_ids)
  order by offering.id
  for update;

  select
    count(*),
    count(distinct offering.academic_period_id),
    count(distinct programme.department_id),
    count(distinct public.canonical_shared_unit_title_for_unit(unit_record.id, unit_record.name)),
    count(distinct coalesce(offering.session_duration_minutes, 120)),
    max(coalesce(offering.weekly_sessions, unit_record.weekly_sessions, 1))::smallint,
    min(coalesce(offering.session_duration_minutes, 120))::smallint,
    (array_agg(offering.academic_period_id))[1],
    (array_agg(programme.department_id))[1],
    coalesce(
      max(
        (
          select group_row.canonical_name
          from public.unit_equivalence_members member
          join public.unit_equivalence_groups group_row
            on group_row.id = member.equivalence_group_id
          where member.unit_id = unit_record.id
            and member.status = 'approved'
            and group_row.status = 'active'
          limit 1
        )
      ),
      min(unit_record.name)
    )
  into
    v_count,
    v_period_count,
    v_department_count,
    v_title_count,
    v_duration_count,
    v_max_weekly_sessions,
    v_session_duration,
    v_period,
    v_department,
    v_title
  from public.unit_offerings offering
  join public.units unit_record on unit_record.id = offering.unit_id
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(v_target_offering_ids)
    and offering.allocation_status = 'unallocated';

  if v_count <> cardinality(v_target_offering_ids) then
    raise exception 'Every shared-class member must still be unallocated';
  end if;
  if v_period_count <> 1 then
    raise exception 'Shared units must belong to the same Academic Period';
  end if;
  if v_department_count <> 1
    or not public.current_user_can_manage_department(v_department) then
    raise exception using
      errcode = '42501',
      message = 'Shared units must belong to your working department';
  end if;
  if v_title_count <> 1 then
    raise exception 'Only equivalent unit titles can be combined';
  end if;
  if v_duration_count <> 1 then
    raise exception 'Shared units must use the same session duration';
  end if;

  if v_group is not null and not exists (
    select 1
    from public.teaching_offerings shared_offering
    where shared_offering.id = v_group
      and shared_offering.academic_period_id = v_period
      and shared_offering.department_id = v_department
  ) then
    raise exception 'The existing shared class is unavailable in this department';
  end if;

  if exists (
    select 1
    from public.unit_offerings offering
    where offering.id = any(v_target_offering_ids)
      and offering.fixed_schedule_required
  ) and (
    exists (
      select 1
      from public.unit_offerings offering
      where offering.id = any(v_target_offering_ids)
        and not offering.fixed_schedule_required
    )
    or (
      select count(distinct concat(
        offering.fixed_working_day_id,
        ':',
        coalesce(
          (
            select string_agg(
              fixed_slot.time_slot_id::text,
              ',' order by fixed_slot.sequence_number
            )
            from public.unit_offering_fixed_slots fixed_slot
            where fixed_slot.unit_offering_id = offering.id
          ),
          offering.fixed_time_slot_id::text,
          ''
        )
      ))
      from public.unit_offerings offering
      where offering.id = any(v_target_offering_ids)
    ) <> 1
  ) then
    raise exception 'Fixed day and sessions must match for every shared unit';
  end if;

  if v_group is null then
    v_key := 'CONFIRMED-' || upper(substr(md5(array_to_string(
      (
        select array_agg(value order by value)
        from unnest(v_target_offering_ids) value
      ),
      ','
    )), 1, 20));

    insert into public.teaching_offerings (
      academic_period_id,
      department_id,
      title,
      shared_class_key,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      notes
    ) values (
      v_period,
      v_department,
      v_title,
      v_key,
      v_max_weekly_sessions,
      v_session_duration,
      'draft',
      true,
      'HOD-confirmed shared class; highest weekly-session requirement applied'
    )
    returning id into v_group;
  else
    update public.teaching_offerings shared_offering
    set
      weekly_sessions = v_max_weekly_sessions,
      session_duration_minutes = v_session_duration,
      updated_at = now(),
      updated_by = auth.uid()
    where shared_offering.id = v_group;
  end if;

  insert into public.teaching_offering_participants (
    teaching_offering_id,
    cohort_id,
    unit_id,
    unit_offering_id,
    is_primary,
    notes
  )
  select
    v_group,
    offering.cohort_id,
    offering.unit_id,
    offering.id,
    not exists (
      select 1
      from public.teaching_offering_participants existing
      where existing.teaching_offering_id = v_group
    ) and row_number() over (order by offering.id) = 1,
    'Confirmed equivalent unit; weekly requirement reconciled to group maximum'
  from public.unit_offerings offering
  where offering.id = any(v_target_offering_ids)
    and not exists (
      select 1
      from public.teaching_offering_participants existing
      where existing.teaching_offering_id = v_group
        and existing.unit_offering_id = offering.id
    );

  update public.unit_offerings offering
  set
    weekly_sessions = v_max_weekly_sessions,
    session_duration_minutes = v_session_duration,
    confirmed_shared_offering_id = v_group,
    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  where offering.id = any(v_target_offering_ids);

  return v_group;
end;
$$;

revoke all on function public.confirm_shared_unit_offerings(uuid[]) from public;
grant execute on function public.confirm_shared_unit_offerings(uuid[]) to authenticated;

create or replace function public.merge_matching_unit_offerings(
  p_academic_period_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  candidate record;
  merged_group_id uuid;
  merged_group_count integer := 0;
  merged_unit_count integer := 0;
  skipped_group_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before merging matching units';
  end if;

  if p_academic_period_id is null or not exists (
    select 1
    from public.academic_periods academic_period
    where academic_period.id = p_academic_period_id
  ) then
    raise exception 'Select a valid Academic Period before merging matching units';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('automatic-same-name-shared-classes'),
    hashtext(p_academic_period_id::text)
  );

  for candidate in
    with eligible as (
      select
        offering.id,
        offering.cohort_id,
        offering.confirmed_shared_offering_id,
        public.canonical_shared_unit_title_for_unit(
          unit_record.id,
          unit_record.name
        ) as canonical_title,
        coalesce(offering.session_duration_minutes, 120) as session_duration_minutes
      from public.unit_offerings offering
      join public.units unit_record
        on unit_record.id = offering.unit_id
      join public.cohorts cohort
        on cohort.id = offering.cohort_id
      join public.programmes programme
        on programme.id = cohort.programme_id
      where offering.academic_period_id = p_academic_period_id
        and programme.department_id = active_department
        and offering.allocation_status = 'unallocated'
        and offering.is_timetable_enabled = true
        and offering.approval_status <> 'withdrawn'
        and offering.selection_state = 'included'
        and coalesce(offering.is_provisionally_reserved, false) = false
        and offering.offering_type not in (
          'clinical_rotation',
          'attachment',
          'examination'
        )
    )
    select
      eligible.canonical_title,
      eligible.session_duration_minutes,
      array_agg(eligible.id order by eligible.id) as offering_ids
    from eligible
    where eligible.canonical_title <> ''
    group by
      eligible.canonical_title,
      eligible.session_duration_minutes
    having count(distinct eligible.cohort_id) > 1
      and count(*) = count(distinct eligible.cohort_id)
      and count(distinct coalesce(
        eligible.confirmed_shared_offering_id,
        eligible.id
      )) > 1
      and count(distinct eligible.confirmed_shared_offering_id) <= 1
    order by eligible.canonical_title
  loop
    begin
      merged_group_id := public.confirm_shared_unit_offerings(
        candidate.offering_ids
      );

      if merged_group_id is not null then
        merged_group_count := merged_group_count + 1;
        merged_unit_count := merged_unit_count
          + cardinality(candidate.offering_ids);
      end if;
    exception
      when raise_exception then
        skipped_group_count := skipped_group_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'mergedGroupCount', merged_group_count,
    'mergedUnitCount', merged_unit_count,
    'skippedGroupCount', skipped_group_count
  );
end;
$$;

revoke all on function public.merge_matching_unit_offerings(uuid) from public;
grant execute on function public.merge_matching_unit_offerings(uuid) to authenticated;

-- ============================================================
-- 3. Target-Period Unit Offering Generation + Auto-Merge
-- ============================================================

create or replace function public.generate_current_unit_offerings(
  p_academic_period_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  v_period_starts_on date;
  v_period_status public.academic_period_status;
  inserted_count integer := 0;
begin
  select starts_on, status
  into v_period_starts_on, v_period_status
  from public.academic_periods
  where id = p_academic_period_id;

  if v_period_starts_on is null then
    raise exception 'Select a valid Academic Period before generating offerings';
  end if;

  if v_period_status not in ('planned', 'active') then
    raise exception 'Offerings can only be generated for planned or active Academic Periods';
  end if;

  with target_cohorts as (
    select
      c.id as cohort_id,
      c.programme_id,
      case
        when v_period_status = 'planned' then
          public.compute_cohort_stage_for_period(
            c.intake_date,
            v_period_starts_on,
            p.total_academic_periods
          )
        else
          coalesce(
            public.compute_cohort_stage_for_period(
              c.intake_date,
              v_period_starts_on,
              p.total_academic_periods
            ),
            c.current_academic_period_number
          )
      end as target_stage
    from public.cohorts c
    join public.programmes p on p.id = c.programme_id
    where c.status in ('active', 'planned')
      and c.is_timetable_available = true
      and p.is_active = true
      and p.is_timetable_available = true
      and (active_department is null or p.department_id = active_department)
      and (c.expected_completion_date is null or c.expected_completion_date >= v_period_starts_on)
  )
  insert into public.unit_offerings (
    academic_period_id,
    cohort_id,
    unit_id,
    offering_type,
    status,
    is_timetable_enabled,
    weekly_sessions,
    session_duration_minutes,
    source,
    origin,
    selection_state,
    recommended_stage_number
  )
  select
    p_academic_period_id,
    tc.cohort_id,
    u.id,
    case
      when coalesce(u.practical_hours, 0) > coalesce(u.theory_hours, 0)
        then 'practical'::public.unit_offering_type
      else 'classroom'::public.unit_offering_type
    end,
    'draft'::public.unit_offering_status,
    true,
    u.weekly_sessions,
    120,
    'active_cohort_curriculum',
    'curriculum',
    'included',
    tc.target_stage
  from target_cohorts tc
  join public.units u
    on u.programme_id = tc.programme_id
   and u.academic_period_number = tc.target_stage
  where tc.target_stage is not null
    and u.is_active = true
    and u.is_timetable_available = true
  on conflict (academic_period_id, cohort_id, unit_id) do nothing;

  get diagnostics inserted_count = row_count;

  -- Automatically combine equivalent/same-name cohorts (e.g. CND + DND)
  -- when an authorized working department is active.
  if active_department is not null then
    perform public.merge_matching_unit_offerings(p_academic_period_id);
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.generate_current_unit_offerings(uuid) from public;
grant execute on function public.generate_current_unit_offerings(uuid) to authenticated;

comment on function public.generate_current_unit_offerings(uuid) is
  'Generates target-period curriculum unit offerings using target-period stage derivation (safe for planned future semesters) and automatically combines equivalent shared classes.';

-- ============================================================
-- 4. Carry-Forward Calendar & Trainer Availability
-- ============================================================

create or replace function public.carry_forward_timetable_setup(
  p_source_period_id uuid,
  p_target_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_status public.academic_period_status;
  v_copied_days integer := 0;
  v_copied_slots integer := 0;
  v_copied_availability integer := 0;
  v_day record;
  v_slot record;
begin
  if v_user_id is null
    or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to copy timetable setup';
  end if;

  if p_source_period_id is null or p_target_period_id is null
    or p_source_period_id = p_target_period_id then
    raise exception 'Select two different Academic Periods';
  end if;

  if not exists (
    select 1 from public.academic_periods where id = p_source_period_id
  ) then
    raise exception 'Source Academic Period was not found';
  end if;

  select status
  into v_target_status
  from public.academic_periods
  where id = p_target_period_id;

  if v_target_status is null then
    raise exception 'Target Academic Period was not found';
  end if;

  if v_target_status = 'archived' then
    raise exception 'Archived Academic Periods cannot be configured';
  end if;

  -- Copy working days idempotently
  for v_day in
    select day_of_week, sequence_number, is_enabled, notes
    from public.working_days
    where academic_period_id = p_source_period_id
      and is_enabled = true
    order by sequence_number
  loop
    if not exists (
      select 1
      from public.working_days existing
      where existing.academic_period_id = p_target_period_id
        and (
          existing.day_of_week = v_day.day_of_week
          or existing.sequence_number = v_day.sequence_number
        )
    ) then
      insert into public.working_days (
        academic_period_id,
        day_of_week,
        sequence_number,
        is_enabled,
        notes,
        created_by,
        updated_by
      ) values (
        p_target_period_id,
        v_day.day_of_week,
        v_day.sequence_number,
        v_day.is_enabled,
        v_day.notes,
        v_user_id,
        v_user_id
      );
      v_copied_days := v_copied_days + 1;
    end if;
  end loop;

  -- Copy time slots idempotently (respecting GiST overlap and unique indexes)
  for v_slot in
    select name, code, slot_type, starts_at, ends_at, sequence_number, is_enabled, notes
    from public.time_slots
    where academic_period_id = p_source_period_id
      and is_enabled = true
    order by sequence_number
  loop
    if not exists (
      select 1
      from public.time_slots existing
      where existing.academic_period_id = p_target_period_id
        and (
          lower(trim(existing.code)) = lower(trim(v_slot.code))
          or lower(trim(existing.name)) = lower(trim(v_slot.name))
          or existing.sequence_number = v_slot.sequence_number
          or (
            existing.is_enabled = true
            and existing.starts_at < v_slot.ends_at
            and v_slot.starts_at < existing.ends_at
          )
        )
    ) then
      insert into public.time_slots (
        academic_period_id,
        name,
        code,
        slot_type,
        starts_at,
        ends_at,
        sequence_number,
        is_enabled,
        notes,
        created_by,
        updated_by
      ) values (
        p_target_period_id,
        v_slot.name,
        v_slot.code,
        v_slot.slot_type,
        v_slot.starts_at,
        v_slot.ends_at,
        v_slot.sequence_number,
        v_slot.is_enabled,
        v_slot.notes,
        v_user_id,
        v_user_id
      );
      v_copied_slots := v_copied_slots + 1;
    end if;
  end loop;

  -- Copy trainer availability mapped by (day_of_week, slot.code)
  insert into public.trainer_availability (
    trainer_id,
    academic_period_id,
    working_day_id,
    time_slot_id,
    created_by
  )
  select
    source_avail.trainer_id,
    p_target_period_id,
    target_day.id,
    target_slot.id,
    v_user_id
  from public.trainer_availability source_avail
  join public.working_days source_day
    on source_day.id = source_avail.working_day_id
  join public.time_slots source_slot
    on source_slot.id = source_avail.time_slot_id
  join public.working_days target_day
    on target_day.academic_period_id = p_target_period_id
   and target_day.day_of_week = source_day.day_of_week
   and target_day.is_enabled = true
  join public.time_slots target_slot
    on target_slot.academic_period_id = p_target_period_id
   and lower(trim(target_slot.code)) = lower(trim(source_slot.code))
   and target_slot.is_enabled = true
  where source_avail.academic_period_id = p_source_period_id
  on conflict (trainer_id, academic_period_id, working_day_id, time_slot_id) do nothing;

  get diagnostics v_copied_availability = row_count;

  return jsonb_build_object(
    'copiedDays', v_copied_days,
    'copiedSlots', v_copied_slots,
    'copiedAvailability', v_copied_availability
  );
end;
$$;

revoke all on function public.carry_forward_timetable_setup(uuid, uuid) from public;
grant execute on function public.carry_forward_timetable_setup(uuid, uuid) to authenticated;

comment on function public.carry_forward_timetable_setup(uuid, uuid) is
  'Copies enabled working days, teaching slots, and trainer availability from a previous period into a planned/active target period without modifying the source period.';

-- ============================================================
-- 5. Sync Fixed-Slot Approval Into Trainer Availability
-- ============================================================
-- When an HOD explicitly pins an agreed weekly slot (e.g. Communication Skills Mon 14-16)
-- on a unit offering and assigns a trainer whose mode is selected_slots_only,
-- register those agreed fixed slots in trainer_availability automatically so
-- the HOD does not have to check the same boxes twice.

create or replace function public.sync_agreed_fixed_slots_availability(
  p_offering_id uuid,
  p_trainer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_id uuid;
  v_fixed_required boolean;
  v_fixed_day uuid;
  v_fixed_slot uuid;
  v_mode text;
begin
  select
    academic_period_id,
    coalesce(fixed_schedule_required, false),
    fixed_working_day_id,
    fixed_time_slot_id
  into
    v_period_id,
    v_fixed_required,
    v_fixed_day,
    v_fixed_slot
  from public.unit_offerings
  where id = p_offering_id;

  if not coalesce(v_fixed_required, false) or v_period_id is null then
    return;
  end if;

  select availability_mode
  into v_mode
  from public.trainers
  where id = p_trainer_id;

  if v_mode is distinct from 'selected_slots_only' then
    return;
  end if;

  insert into public.trainer_availability (
    trainer_id,
    academic_period_id,
    working_day_id,
    time_slot_id,
    created_by
  )
  select
    p_trainer_id,
    v_period_id,
    fs.working_day_id,
    fs.time_slot_id,
    auth.uid()
  from public.unit_offering_fixed_slots fs
  where fs.unit_offering_id = p_offering_id
    and fs.working_day_id is not null
    and fs.time_slot_id is not null
  on conflict (trainer_id, academic_period_id, working_day_id, time_slot_id) do nothing;

  if v_fixed_day is not null and v_fixed_slot is not null then
    insert into public.trainer_availability (
      trainer_id,
      academic_period_id,
      working_day_id,
      time_slot_id,
      created_by
    ) values (
      p_trainer_id,
      v_period_id,
      v_fixed_day,
      v_fixed_slot,
      auth.uid()
    )
    on conflict (trainer_id, academic_period_id, working_day_id, time_slot_id) do nothing;
  end if;
end;
$$;

revoke all on function public.sync_agreed_fixed_slots_availability(uuid, uuid) from public;
grant execute on function public.sync_agreed_fixed_slots_availability(uuid, uuid) to authenticated;

-- ============================================================
-- 6. Date-Scoped Unique Events & Exceptions
-- ============================================================

create table if not exists public.timetable_calendar_events (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  event_type text not null check (event_type in ('holiday', 'cat_exam', 'seminar', 'field_trip', 'custom')),
  event_date date not null,
  starts_at time,
  ends_at time,
  scope_type text not null default 'institution' check (scope_type in ('institution', 'cohort', 'trainer', 'room')),
  scope_id uuid,
  suspends_regular_classes boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_calendar_events_scope_check check (
    (scope_type = 'institution' and scope_id is null)
    or (scope_type <> 'institution' and scope_id is not null)
  ),
  constraint timetable_calendar_events_time_check check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and starts_at < ends_at)
  )
);

create index if not exists timetable_calendar_events_period_idx
  on public.timetable_calendar_events (academic_period_id, department_id, is_active, event_date);

alter table public.timetable_calendar_events enable row level security;

drop policy if exists timetable_calendar_events_read on public.timetable_calendar_events;
create policy timetable_calendar_events_read on public.timetable_calendar_events
for select to authenticated
using (department_id = public.current_user_primary_department_id());

drop policy if exists timetable_calendar_events_manage on public.timetable_calendar_events;
create policy timetable_calendar_events_manage on public.timetable_calendar_events
for all to authenticated
using (
  department_id = public.current_user_primary_department_id()
  and public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
)
with check (
  department_id = public.current_user_primary_department_id()
  and public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
);

grant select, insert, update, delete on public.timetable_calendar_events to authenticated;

commit;
