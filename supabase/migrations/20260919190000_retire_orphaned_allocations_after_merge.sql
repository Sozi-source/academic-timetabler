-- Migration: Retire Orphaned Allocations Left Behind by Shared-Class Merges
-- Date: 2026-09-19
-- Description:
--   HOD reported placing CHN 2202 (Management of Malnutrition, CHN-MAY-2025, Sept-Dec 2026)
--   blocked by a "Cohort Conflict" naming DND 2101 (same subject) with Fiona Kwamboka in
--   PHYSIOGYM at the same time -- for the SAME cohort, not a different one.
--
--   Root cause, confirmed by direct query against the live data (not a phantom-participant
--   or cross-period issue -- both already ruled out):
--     - unit_offerings row 6d6ac895 (CHN-MAY-2025 / CHN 2202, period 2026) already says
--       allocation_status = 'allocated', confirmed_shared_offering_id = e63c1b7d -- the SAME
--       shared teaching_offering that DND 2101 and CND 2101 were merged into. The system
--       considers this cohort's delivery of the subject already handled by that shared class.
--     - But teaching_allocations row e87b70b0 (same cohort, same unit, same period) was never
--       updated to match: teaching_offering_id is still null, status is still 'draft',
--       is_timetable_enabled is still true, and it has zero scheduled_sessions of its own.
--     - public.confirm_shared_unit_offerings() (20260816005000) only ever touches
--       unit_offerings and teaching_offering_participants. It was written assuming no
--       teaching_allocation exists yet for a unit being merged. When one already does (the
--       ordinary single-cohort approval path creates one independently), the merge leaves it
--       behind: still visible in "Units missing from timetable", still independently
--       placeable, and correctly rejected when placed because the cohort is already occupied
--       by the class it should have joined.
--
--   This is a distinct defect from the phantom-participant-array fix (20260919160000,
--   under-widening at read time) and the unit-equivalence merge wiring (20260919170000,
--   pre-placement grouping): this one is about a record left inconsistent by the merge
--   itself, after the fact, at the allocation layer the editor UI actually reads from.
--
--   Fix:
--     1. One-off repair: retire (suspend, disable, link) every teaching_allocation currently
--        in this orphaned state.
--     2. A trigger so this can never recur: whenever a unit_offering is merged into a shared
--        class going forward, any pre-existing standalone allocation for that same
--        cohort/unit/period that has no sessions of its own is retired in the same
--        transaction that performs the merge.
--     3. public.audit_orphaned_merged_allocations() for verification and ongoing monitoring,
--        matching the existing public.audit_phantom_session_participants() pattern.

begin;

-- ============================================================
-- 1. One-off repair
-- ============================================================

update public.teaching_allocations orphan
set
  teaching_offering_id = matched.confirmed_shared_offering_id,
  status = 'suspended'::public.teaching_allocation_status,
  is_timetable_enabled = false,
  notes = trim(both E'\n' from coalesce(orphan.notes, '') || E'\n' ||
    'Auto-retired ' || to_char(now(), 'YYYY-MM-DD') ||
    ': this cohort''s delivery of this unit is already covered by shared class ' ||
    matched.confirmed_shared_offering_id::text || '.'),
  updated_at = now(),
  updated_by = coalesce(auth.uid(), orphan.updated_by)
from (
  select
    unit_offering.academic_period_id,
    unit_offering.cohort_id,
    unit_offering.unit_id,
    unit_offering.confirmed_shared_offering_id
  from public.unit_offerings unit_offering
  where unit_offering.allocation_status = 'allocated'
    and unit_offering.confirmed_shared_offering_id is not null
) matched
where orphan.academic_period_id = matched.academic_period_id
  and orphan.cohort_id = matched.cohort_id
  and orphan.unit_id = matched.unit_id
  and orphan.status in ('draft', 'active')
  and orphan.is_timetable_enabled = true
  and orphan.teaching_offering_id is distinct from matched.confirmed_shared_offering_id
  and not exists (
    select 1
    from public.scheduled_sessions session
    where session.teaching_allocation_id = orphan.id
      and session.status not in ('cancelled', 'archived')
  );

-- ============================================================
-- 2. Prevent recurrence
-- ============================================================

create or replace function public.retire_orphaned_allocation_after_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.confirmed_shared_offering_id is not null
    and new.allocation_status = 'allocated'
    and (
      old.confirmed_shared_offering_id is distinct from new.confirmed_shared_offering_id
      or old.allocation_status is distinct from new.allocation_status
    )
  then
    begin
      update public.teaching_allocations orphan
      set
        teaching_offering_id = new.confirmed_shared_offering_id,
        status = 'suspended'::public.teaching_allocation_status,
        is_timetable_enabled = false,
        notes = trim(both E'\n' from coalesce(orphan.notes, '') || E'\n' ||
          'Auto-retired ' || to_char(now(), 'YYYY-MM-DD') ||
          ': this cohort''s delivery of this unit is already covered by shared class ' ||
          new.confirmed_shared_offering_id::text || '.'),
        updated_at = now(),
        updated_by = auth.uid()
      where orphan.academic_period_id = new.academic_period_id
        and orphan.cohort_id = new.cohort_id
        and orphan.unit_id = new.unit_id
        and orphan.status in ('draft', 'active')
        and orphan.is_timetable_enabled = true
        and orphan.teaching_offering_id is distinct from new.confirmed_shared_offering_id
        and not exists (
          select 1
          from public.scheduled_sessions session
          where session.teaching_allocation_id = orphan.id
            and session.status not in ('cancelled', 'archived')
        );
    exception when others then
      -- This cleanup must never block the merge/approval that triggered it.
      raise warning 'Orphaned-allocation retirement skipped for offering %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists unit_offerings_retire_orphaned_allocation on public.unit_offerings;

create trigger unit_offerings_retire_orphaned_allocation
after update on public.unit_offerings
for each row
execute function public.retire_orphaned_allocation_after_merge();

comment on function public.retire_orphaned_allocation_after_merge() is
  'When a unit offering is merged into a shared class (confirmed_shared_offering_id set, allocation_status = allocated), retires any pre-existing standalone teaching_allocation for the same cohort/unit/period that has no scheduled_sessions of its own, so it stops appearing as unplaced and stops colliding with the shared class it was actually absorbed into.';

-- ============================================================
-- 3. Verification / monitoring
-- ============================================================

create or replace function public.audit_orphaned_merged_allocations(
  p_academic_period_id uuid default null
)
returns table (
  allocation_id uuid,
  academic_period_id uuid,
  cohort_code text,
  unit_code text,
  confirmed_shared_offering_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    allocation.id,
    allocation.academic_period_id,
    cohort.code,
    unit.code,
    unit_offering.confirmed_shared_offering_id
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.units unit on unit.id = allocation.unit_id
  join public.unit_offerings unit_offering
    on unit_offering.academic_period_id = allocation.academic_period_id
    and unit_offering.cohort_id = allocation.cohort_id
    and unit_offering.unit_id = allocation.unit_id
  where unit_offering.allocation_status = 'allocated'
    and unit_offering.confirmed_shared_offering_id is not null
    and allocation.status in ('draft', 'active')
    and allocation.is_timetable_enabled = true
    and allocation.teaching_offering_id is distinct from unit_offering.confirmed_shared_offering_id
    and (p_academic_period_id is null or allocation.academic_period_id = p_academic_period_id)
    and not exists (
      select 1
      from public.scheduled_sessions session
      where session.teaching_allocation_id = allocation.id
        and session.status not in ('cancelled', 'archived')
    );
$$;

revoke all on function public.audit_orphaned_merged_allocations(uuid) from public;
grant execute on function public.audit_orphaned_merged_allocations(uuid) to authenticated;

comment on function public.audit_orphaned_merged_allocations(uuid) is
  'Lists teaching_allocations left inconsistent by a unit-offering merge into a shared class -- should return zero rows after this migration, and stay at zero going forward.';

commit;
