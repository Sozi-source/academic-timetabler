-- Fix department helper name in public.generate_current_unit_offerings
-- (`public.current_user_primary_department_id()` rather than `get_active_department_id()`).

begin;

create or replace function public.generate_current_unit_offerings(
  p_academic_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  inserted_count integer := 0;
  v_period_starts_on date;
  v_period_status text;
begin
  if p_academic_period_id is null then
    raise exception 'Select a valid Academic Period before generating offerings';
  end if;

  select starts_on, status::text
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
    where (
      (v_period_status = 'planned' and c.status in ('active', 'planned'))
      or (v_period_status <> 'planned' and c.status = 'active')
    )
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
