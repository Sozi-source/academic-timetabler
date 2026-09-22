-- Automatically combine equivalent, unallocated units taught to different
-- cohorts. Unit codes are deliberately ignored: the normalized title and
-- session duration define the shared subject inside one department and period.

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
        offering.offering_type,
        offering.confirmed_shared_offering_id,
        public.canonical_shared_unit_title(unit_record.name) as canonical_title,
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
      eligible.offering_type,
      array_agg(eligible.id order by eligible.id) as offering_ids
    from eligible
    where eligible.canonical_title <> ''
    group by
      eligible.canonical_title,
      eligible.session_duration_minutes,
      eligible.offering_type
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
        -- A fixed-schedule mismatch or another domain validation keeps this
        -- candidate separate and visible for manual correction.
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

revoke all
on function public.merge_matching_unit_offerings(uuid)
from public;

grant execute
on function public.merge_matching_unit_offerings(uuid)
to authenticated;

comment on function public.merge_matching_unit_offerings(uuid) is
  'Combines unallocated same-title, equal-duration units across cohorts in the active department; unit codes may differ and incompatible fixed schedules remain separate.';
