begin;

-- ============================================================================
-- Academic Planner V20
-- Teaching Allocation RLS Recursion Repair
--
-- Root cause:
-- Trainer read policies on Academic Periods / Cohorts / Units / Assessment
-- Rules directly queried teaching_allocations. At the same time an older
-- teaching_allocations policy queried Cohorts. PostgreSQL therefore entered:
--
-- academic_periods
--   -> teaching_allocations
--     -> cohorts
--       -> teaching_allocations
--
-- and stopped with:
--   infinite recursion detected in policy for relation "teaching_allocations"
--
-- Repair:
-- 1. Replace every teaching_allocations policy with canonical non-recursive
--    policies.
-- 2. Move allocation-scope checks into SECURITY DEFINER helpers.
-- 3. Replace V9 trainer policies that directly query teaching_allocations.
-- 4. Preserve HOD/system-admin department boundaries and trainer allocation
--    boundaries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Capability identity.
-- Keep V13 capability behaviour: HOD/system-admin profiles may also teach when
-- linked to an active trainer record.
-- ----------------------------------------------------------------------------

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    trainer.id
  from public.trainers
    as trainer
  join public.profiles
    as profile
    on profile.id =
      trainer.profile_id
  where trainer.profile_id =
      auth.uid()
    and trainer.is_active =
      true
    and profile.is_active =
      true
    and profile.role::text in (
      'trainer',
      'hod',
      'system_admin'
    )
  limit 1;
$$;

revoke all
on function public.current_trainer_id()
from public;

grant execute
on function public.current_trainer_id()
to authenticated;

-- ----------------------------------------------------------------------------
-- Department resolution for an allocation row.
--
-- This function receives row values rather than querying teaching_allocations.
-- The only lookup is cohort -> programme -> department and it runs as the
-- function owner with RLS disabled, so it cannot recurse through cohort RLS.
-- ----------------------------------------------------------------------------

create or replace function public.current_user_can_read_teaching_allocation(
  target_cohort_id uuid,
  target_trainer_id uuid,
  target_status text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    (
      exists (
        select 1
        from public.cohorts
          as cohort
        join public.programmes
          as programme
          on programme.id =
            cohort.programme_id
        where cohort.id =
            target_cohort_id
          and public.current_user_can_access_department(
            programme.department_id
          )
      )
      and public.current_user_has_role(
        array[
          'hod',
          'system_admin'
        ]::public.app_role[]
      )
    )
    or (
      target_trainer_id =
        public.current_trainer_id()
      and target_status in (
        'active',
        'completed'
      )
    );
$$;

revoke all
on function public.current_user_can_read_teaching_allocation(
  uuid,
  uuid,
  text
)
from public;

grant execute
on function public.current_user_can_read_teaching_allocation(
  uuid,
  uuid,
  text
)
to authenticated;

create or replace function public.current_user_can_manage_teaching_allocation(
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
    from public.cohorts
      as cohort
    join public.programmes
      as programme
      on programme.id =
        cohort.programme_id
    where cohort.id =
        target_allocation_id
      and public.current_user_can_manage_department(
        programme.department_id
      )
  );
$$;

revoke all
on function public.current_user_can_manage_teaching_allocation(uuid)
from public;

grant execute
on function public.current_user_can_manage_teaching_allocation(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Trainer scope helper.
--
-- Policies on other tables call this function instead of embedding a SELECT
-- from teaching_allocations in the policy expression.
-- ----------------------------------------------------------------------------

create or replace function public.trainer_has_allocation_scope(
  target_academic_period_id uuid,
  target_cohort_id uuid,
  target_unit_id uuid
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
    from public.teaching_allocations
      as allocation
    where allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
      and (
        target_academic_period_id is null
        or allocation.academic_period_id =
          target_academic_period_id
      )
      and (
        target_cohort_id is null
        or allocation.cohort_id =
          target_cohort_id
        or (
          allocation.participant_cohort_ids is not null
          and target_cohort_id =
            any(
              allocation.participant_cohort_ids
            )
        )
      )
      and (
        target_unit_id is null
        or allocation.unit_id =
          target_unit_id
      )
  );
$$;

revoke all
on function public.trainer_has_allocation_scope(
  uuid,
  uuid,
  uuid
)
from public;

grant execute
on function public.trainer_has_allocation_scope(
  uuid,
  uuid,
  uuid
)
to authenticated;

-- Keep the established helper API used by assessment, document and attendance
-- policies, but make the RLS bypass explicit.
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
    from public.teaching_allocations
      as allocation
    where allocation.id =
        target_allocation_id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  );
$$;

revoke all
on function public.trainer_can_access_allocation(uuid)
from public;

grant execute
on function public.trainer_can_access_allocation(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Canonical Teaching Allocation policies.
--
-- Remove every accumulated policy on this table first. Multiple generations
-- of permissive policies were the source of the recursive graph.
-- ----------------------------------------------------------------------------

do $$
declare
  policy_row record;
begin
  for policy_row in
    select
      policyname
    from pg_policies
    where schemaname =
        'public'
      and tablename =
        'teaching_allocations'
  loop
    execute format(
      'drop policy %I on public.teaching_allocations',
      policy_row.policyname
    );
  end loop;
end;
$$;

create policy teaching_allocations_select_v20
on public.teaching_allocations
for select
to authenticated
using (
  public.current_user_can_read_teaching_allocation(
    cohort_id,
    trainer_id,
    status::text
  )
);

create policy teaching_allocations_insert_v20
on public.teaching_allocations
for insert
to authenticated
with check (
  public.current_user_can_manage_teaching_allocation(
    cohort_id
  )
  and created_by =
    auth.uid()
);

create policy teaching_allocations_update_v20
on public.teaching_allocations
for update
to authenticated
using (
  public.current_user_can_manage_teaching_allocation(
    cohort_id
  )
)
with check (
  public.current_user_can_manage_teaching_allocation(
    cohort_id
  )
);

-- No DELETE policy is intentionally provided.
-- Allocation history remains retained.

-- ----------------------------------------------------------------------------
-- Replace recursive V9 trainer policies.
-- HOD/system-admin policies remain intact.
-- ----------------------------------------------------------------------------

drop policy if exists
  v9_trainer_periods_read
on public.academic_periods;

create policy v20_trainer_periods_read
on public.academic_periods
for select
to authenticated
using (
  public.trainer_has_allocation_scope(
    id,
    null,
    null
  )
);

drop policy if exists
  v9_trainer_cohorts_read
on public.cohorts;

create policy v20_trainer_cohorts_read
on public.cohorts
for select
to authenticated
using (
  public.trainer_has_allocation_scope(
    null,
    id,
    null
  )
);

drop policy if exists
  v9_trainer_units_read
on public.units;

create policy v20_trainer_units_read
on public.units
for select
to authenticated
using (
  public.trainer_has_allocation_scope(
    null,
    null,
    id
  )
);

drop policy if exists
  v9_trainer_rules_read
on public.assessment_rules;

create policy v20_trainer_rules_read
on public.assessment_rules
for select
to authenticated
using (
  public.trainer_has_allocation_scope(
    academic_period_id,
    null,
    unit_id
  )
);

comment on function public.current_user_can_read_teaching_allocation(
  uuid,
  uuid,
  text
) is
  'Non-recursive RLS helper for HOD/system-admin department access or assigned trainer read access to a teaching allocation row.';

comment on function public.current_user_can_manage_teaching_allocation(uuid) is
  'Non-recursive RLS helper for department-scoped HOD/system-admin teaching allocation writes.';

comment on function public.trainer_has_allocation_scope(
  uuid,
  uuid,
  uuid
) is
  'Security-definer allocation-scope lookup used by trainer RLS without recursively evaluating teaching_allocations policies.';

comment on function public.trainer_can_access_allocation(uuid) is
  'Checks active/completed trainer allocation access with explicit RLS bypass for safe use inside dependent table policies.';

commit;
