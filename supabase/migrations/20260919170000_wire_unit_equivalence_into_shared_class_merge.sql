-- Migration: Wire Approved Unit Equivalence Into Shared-Class Merging
-- Date: 2026-09-19
-- Description:
--   HOD reported "Management of Malnutrition" (CHN 2202, CHN-MAY-2025) and "Food Production
--   for Invalids and Convalescents" (DND 1304, DND-JAN-MAR-2026) sitting as separate unplaced
--   allocations instead of being combined with the other cohorts that take the same subject
--   under a different title, and asked that "all similar unit names should allow cohort
--   sharing with same trainer at the same time and venue".
--
--   Root cause: two disconnected systems.
--     1. public.unit_equivalence_groups / unit_equivalence_members — the HOD-approved academic
--        equivalence record (reviewed at /timetable/unit-equivalence). Its own page copy is
--        explicit that this is deliberate: "Approve academic equivalence once; sharing remains
--        a separate period-specific decision" / "Similarity never renames, approves, allocates,
--        or merges a unit."
--     2. public.merge_matching_unit_offerings() (20260816050000_automatic_same_name_shared_classes.sql)
--        — the function that actually combines unallocated offerings across cohorts into one
--        shared class via public.confirm_shared_unit_offerings(). It groups purely by
--        public.canonical_shared_unit_title(unit.name) — punctuation/case/whitespace
--        normalization plus a handful of migrations' worth of hardcoded title-variant mappings
--        (diet therapy, non-communicable diseases, etc.) added one pair at a time. Two units
--        the HOD has approved as equivalent, but that are worded differently, are invisible to
--        it unless someone ships a new migration hardcoding that exact pair.
--     3. Independently of (1) vs (2): public.merge_matching_unit_offerings() is never called
--        from anywhere in the application (no server action, no UI control references it) — so
--        even units sharing the exact same canonical title do not merge automatically today,
--        contrary to its name and comment.
--
--   Fix:
--     1. public.canonical_shared_unit_title_for_unit(unit_id, fallback_title) — consults an
--        approved, active equivalence group for the unit first (falling back to the existing
--        text-normalization function). This is additive: canonical_shared_unit_title(text)
--        itself is untouched, so every other historical caller of it is unaffected.
--     2. public.merge_matching_unit_offerings() now resolves each candidate's canonical title
--        through the unit-aware resolver instead of the bare text function. Every existing
--        safety guard (same session duration, one cohort per offering, excluded offering
--        types, unallocated-only, department-scoped, wrapped per-candidate so one domain
--        validation failure doesn't abort the batch) is unchanged.
--     3. runCombineMatchingUnitsAction (application layer, see actions.ts) exposes the
--        previously-orphaned RPC as a button next to "Units missing from timetable".
--
--   This does not, by itself, combine the two units the HOD asked about — that requires the
--   HOD to first approve them as equivalent (or exact-title-normalize identically), which is
--   an academic judgement call the system deliberately does not make unattended. See the
--   accompanying message for the exact next step for this specific report.

begin;

create or replace function public.canonical_shared_unit_title_for_unit(
  p_unit_id uuid,
  p_fallback_title text default null
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.canonical_shared_unit_title(
    coalesce(
      (
        select group_row.canonical_name
        from public.unit_equivalence_members member
        join public.unit_equivalence_groups group_row
          on group_row.id = member.equivalence_group_id
        where member.unit_id = p_unit_id
          and member.status = 'approved'
          and group_row.status = 'active'
        limit 1
      ),
      p_fallback_title,
      (select unit_row.name from public.units unit_row where unit_row.id = p_unit_id)
    )
  );
$$;

revoke all on function public.canonical_shared_unit_title_for_unit(uuid, text) from public;
grant execute on function public.canonical_shared_unit_title_for_unit(uuid, text) to authenticated;

comment on function public.canonical_shared_unit_title_for_unit(uuid, text) is
  'Canonical shared-class title for a unit: an HOD-approved, active equivalence group''s name takes priority; otherwise falls back to canonical_shared_unit_title() text normalization. Lets approved academic equivalence (/timetable/unit-equivalence) drive automatic offering merging, not only literal title matches.';

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
  'Combines unallocated units across cohorts in the active department that share a canonical title — either an approved equivalence group''s name or exact-normalized text — with equal session duration and no excluded offering type; unit codes may differ and incompatible fixed schedules remain separate.';

commit;
