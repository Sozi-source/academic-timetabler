-- Existing Units on Offer can predate the readiness-stage normalizer. Because
-- the readiness insert is idempotent (ON CONFLICT DO NOTHING), those rows must
-- be normalized explicitly before trainer-pending allocations are created.

create or replace function public.include_all_unassigned_unit_offerings(
  p_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  candidate record;
  generated_offering_count integer := 0;
  included_allocation_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before including unassigned units';
  end if;

  if not exists (
    select 1
    from public.academic_periods period
    where period.id = p_academic_period_id
      and period.status in ('planned', 'active')
  ) then
    raise exception 'Select a planned or active Academic Period';
  end if;

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
    recommended_stage_number,
    exception_reason
  )
  select distinct
    p_academic_period_id,
    participant.cohort_id,
    participant.unit_id,
    case
      when coalesce(unit_record.practical_hours, 0) >
        coalesce(unit_record.theory_hours, 0)
        then 'practical'::public.unit_offering_type
      else 'classroom'::public.unit_offering_type
    end,
    'draft'::public.unit_offering_status,
    true,
    shared.weekly_sessions,
    shared.session_duration_minutes,
    'readiness_bulk_include',
    case
      when unit_record.academic_period_number =
        cohort.current_academic_period_number
        then 'curriculum'::public.unit_offering_origin
      else 'legacy'::public.unit_offering_origin
    end,
    'included'::public.unit_offering_selection_state,
    case
      when unit_record.academic_period_number =
        cohort.current_academic_period_number
        then cohort.current_academic_period_number
      else null
    end,
    case
      when unit_record.academic_period_number =
        cohort.current_academic_period_number
        then null
      else 'Cross-stage teaching offering retained from the readiness register'
    end
  from public.teaching_offerings shared
  join public.teaching_offering_participants participant
    on participant.teaching_offering_id = shared.id
  join public.cohorts cohort on cohort.id = participant.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  join public.units unit_record on unit_record.id = participant.unit_id
  where shared.academic_period_id = p_academic_period_id
    and shared.is_timetable_enabled = true
    and shared.status in ('draft', 'active')
    and programme.department_id = active_department
  on conflict (academic_period_id, cohort_id, unit_id) do nothing;

  get diagnostics generated_offering_count = row_count;

  -- Normalize pre-existing conflicting rows only when the exact cohort/unit is
  -- still an enabled participant in this period's readiness register.
  update public.unit_offerings offering
  set
    origin = 'legacy'::public.unit_offering_origin,
    recommended_stage_number = null,
    exception_reason = coalesce(
      nullif(trim(offering.exception_reason), ''),
      'Cross-stage teaching offering retained from the readiness register'
    ),
    updated_at = now(),
    updated_by = auth.uid()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  join public.units unit_record
    on unit_record.programme_id = cohort.programme_id
  where offering.academic_period_id = p_academic_period_id
    and offering.cohort_id = cohort.id
    and offering.unit_id = unit_record.id
    and programme.department_id = active_department
    and offering.is_timetable_enabled = true
    and unit_record.academic_period_number is distinct from
      cohort.current_academic_period_number
    and exists (
      select 1
      from public.teaching_offering_participants participant
      join public.teaching_offerings shared
        on shared.id = participant.teaching_offering_id
      where shared.academic_period_id = p_academic_period_id
        and shared.is_timetable_enabled = true
        and shared.status in ('draft', 'active')
        and participant.cohort_id = offering.cohort_id
        and participant.unit_id = offering.unit_id
    );

  update public.unit_offerings offering
  set
    confirmed_shared_offering_id = shared.id,
    updated_at = now(),
    updated_by = auth.uid()
  from public.teaching_offering_participants participant
  join public.teaching_offerings shared
    on shared.id = participant.teaching_offering_id
  join public.cohorts cohort on cohort.id = participant.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.academic_period_id = p_academic_period_id
    and offering.cohort_id = participant.cohort_id
    and offering.unit_id = participant.unit_id
    and offering.confirmed_shared_offering_id is null
    and shared.academic_period_id = p_academic_period_id
    and shared.is_timetable_enabled = true
    and programme.department_id = active_department
    and (
      shared.shared_class_key is not null
      or (
        select count(*)
        from public.teaching_offering_participants member
        where member.teaching_offering_id = shared.id
      ) > 1
    );

  update public.unit_offerings offering
  set
    allocation_status = case
      when exists (
        select 1
        from public.teaching_allocations allocation
        where allocation.academic_period_id = offering.academic_period_id
          and allocation.status in ('draft', 'active')
          and allocation.trainer_id is not null
          and (
            allocation.teaching_offering_id =
              offering.confirmed_shared_offering_id
            or (
              allocation.cohort_id = offering.cohort_id
              and allocation.unit_id = offering.unit_id
            )
          )
      ) then 'allocated'
      else offering.allocation_status
    end,
    is_provisionally_reserved = exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = offering.academic_period_id
        and allocation.status in ('draft', 'active')
        and allocation.trainer_id is null
        and (
          allocation.teaching_offering_id =
            offering.confirmed_shared_offering_id
          or (
            allocation.cohort_id = offering.cohort_id
            and allocation.unit_id = offering.unit_id
          )
        )
    ),
    updated_at = now(),
    updated_by = auth.uid()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.cohort_id = cohort.id
    and offering.academic_period_id = p_academic_period_id
    and programme.department_id = active_department;

  for candidate in
    select offering.id
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where offering.academic_period_id = p_academic_period_id
      and programme.department_id = active_department
      and offering.is_timetable_enabled = true
      and offering.allocation_status = 'unallocated'
      and offering.is_provisionally_reserved = false
      and not exists (
        select 1
        from public.teaching_allocations allocation
        where allocation.academic_period_id = offering.academic_period_id
          and allocation.status in ('draft', 'active')
          and (
            allocation.teaching_offering_id =
              offering.confirmed_shared_offering_id
            or (
              allocation.cohort_id = offering.cohort_id
              and allocation.unit_id = offering.unit_id
            )
          )
      )
      and (
        offering.confirmed_shared_offering_id is null
        or offering.id = (
          select min(member.id::text)::uuid
          from public.unit_offerings member
          where member.confirmed_shared_offering_id =
            offering.confirmed_shared_offering_id
            and member.allocation_status = 'unallocated'
        )
      )
    order by offering.id
  loop
    perform public.reserve_unit_offering_without_trainer(candidate.id);
    included_allocation_count := included_allocation_count + 1;
  end loop;

  return jsonb_build_object(
    'generatedOfferingCount', generated_offering_count,
    'includedAllocationCount', included_allocation_count
  );
end;
$$;

revoke all
on function public.include_all_unassigned_unit_offerings(uuid)
from public;

grant execute
on function public.include_all_unassigned_unit_offerings(uuid)
to authenticated;

comment on function public.include_all_unassigned_unit_offerings(uuid) is
  'Normalizes audited cross-stage readiness rows and creates trainer-pending allocations for all unassigned Units on Offer in the current working department.';
