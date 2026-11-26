-- Allow `unit_offerings` curriculum recommendations (`origin = 'curriculum'`)
-- to match the target period's computed stage when `academic_periods.status = 'planned'`
-- (e.g. JAN-APR-27) while keeping strict `cohort.current_academic_period_number`
-- validation on active/historical periods.

begin;

create or replace function public.validate_unit_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_programme public.programmes%rowtype;
  selected_unit public.units%rowtype;
  expected_stage integer;
begin
  select *
  into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  select *
  into selected_programme
  from public.programmes
  where id = selected_cohort.programme_id;

  select *
  into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit not found';
  end if;

  if selected_cohort.programme_id <> selected_unit.programme_id then
    raise exception using
      errcode = '23514',
      message = 'A Unit on Offer must belong to the same programme as its cohort';
  end if;

  if new.origin = 'curriculum' then
    if selected_period.status = 'planned' then
      expected_stage := coalesce(
        public.compute_cohort_stage_for_period(
          selected_cohort.intake_date,
          selected_period.starts_on,
          selected_programme.total_academic_periods
        ),
        selected_cohort.current_academic_period_number
      );
    else
      expected_stage := selected_cohort.current_academic_period_number;
    end if;

    if selected_unit.academic_period_number <> expected_stage then
      raise exception using
        errcode = '23514',
        message = 'A curriculum recommendation must belong to the cohort target academic stage';
    end if;

    new.recommended_stage_number = expected_stage;
  end if;

  if new.origin = 'special' then
    if new.exception_reason is null
       or char_length(trim(new.exception_reason)) < 3 then
      raise exception using
        errcode = '23514',
        message = 'A special Unit on Offer requires an exception reason';
    end if;
  end if;

  if new.selection_state = 'excluded' then
    new.is_timetable_enabled = false;

    if new.status <> 'cancelled' then
      new.status = 'cancelled'::public.unit_offering_status;
    end if;

    if new.exception_reason is null or char_length(trim(new.exception_reason)) < 3 then
      new.exception_reason = coalesce(
        nullif(trim(new.withdrawal_reason), ''),
        'Excluded from active cohort teaching plan'
      );
    end if;
  end if;

  if new.offering_type in (
    'clinical_rotation',
    'attachment',
    'examination'
  ) then
    new.is_timetable_enabled = false;
  end if;

  if new.manually_reviewed then
    new.reviewed_by = coalesce(new.reviewed_by, auth.uid());
    new.reviewed_at = coalesce(new.reviewed_at, now());
  else
    new.reviewed_by = null;
    new.reviewed_at = null;
  end if;

  new.source = trim(new.source);

  if new.exception_reason is not null then
    new.exception_reason = trim(new.exception_reason);
  end if;

  return new;
end;
$$;

create or replace function public.normalize_readiness_bulk_unit_offering_stage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_programme public.programmes%rowtype;
  cohort_stage integer;
  unit_stage integer;
begin
  if new.source <> 'readiness_bulk_include'
    or new.origin <> 'curriculum' then
    return new;
  end if;

  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  select * into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  select * into selected_programme
  from public.programmes
  where id = selected_cohort.programme_id;

  if selected_period.status = 'planned' then
    cohort_stage := coalesce(
      public.compute_cohort_stage_for_period(
        selected_cohort.intake_date,
        selected_period.starts_on,
        selected_programme.total_academic_periods
      ),
      selected_cohort.current_academic_period_number
    );
  else
    cohort_stage := selected_cohort.current_academic_period_number;
  end if;

  select unit_record.academic_period_number
  into unit_stage
  from public.units unit_record
  where unit_record.id = new.unit_id;

  if unit_stage is distinct from cohort_stage then
    new.origin = 'legacy'::public.unit_offering_origin;
    new.recommended_stage_number = null;
    new.exception_reason = coalesce(
      new.exception_reason,
      'Cross-stage teaching offering retained from the readiness register'
    );
  end if;

  return new;
end;
$$;

-- Guard weekly_sessions >= 1 in generate_current_unit_offerings
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
    greatest(1, coalesce(u.weekly_sessions, 1)),
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

  if active_department is not null then
    perform public.merge_matching_unit_offerings(p_academic_period_id);
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.generate_current_unit_offerings(uuid) from public;
grant execute on function public.generate_current_unit_offerings(uuid) to authenticated;

commit;
