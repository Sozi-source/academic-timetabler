-- ============================================================
-- Academic Planner: cohort lifecycle reconciliation
-- ============================================================
-- Expired active cohorts become completed and stop participating
-- in future timetable generation. Historical records are retained.
-- ============================================================

create or replace function public.reconcile_expired_cohorts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids uuid[];
  affected_count integer := 0;
begin
  select coalesce(array_agg(c.id), '{}'::uuid[])
  into expired_ids
  from public.cohorts c
  where c.status = 'active'
    and c.expected_completion_date < current_date;

  affected_count := cardinality(expired_ids);

  if affected_count = 0 then
    return 0;
  end if;

  update public.cohorts c
  set
    status = 'completed'::public.cohort_status,
    is_timetable_available = false,
    updated_at = now()
  where c.id = any(expired_ids);

  update public.unit_offerings uo
  set
    is_timetable_enabled = false,
    updated_at = now()
  where uo.cohort_id = any(expired_ids)
    and uo.is_timetable_enabled = true;

  update public.teaching_allocations ta
  set
    is_timetable_enabled = false,
    updated_at = now()
  where ta.cohort_id = any(expired_ids)
    and ta.is_timetable_enabled = true;

  -- Shared-class allocations may contain additional participant cohorts.
  -- Disable them too when that column exists.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'participant_cohort_ids'
  ) then
    execute '
      update public.teaching_allocations
      set
        is_timetable_enabled = false,
        updated_at = now()
      where is_timetable_enabled = true
        and participant_cohort_ids && $1
    '
    using expired_ids;
  end if;

  return affected_count;
end;
$$;

revoke all
on function public.reconcile_expired_cohorts()
from public, anon, authenticated;

create or replace function public.enforce_cohort_completion_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if
    new.status = 'active'::public.cohort_status
    and new.expected_completion_date < current_date
  then
    new.status := 'completed'::public.cohort_status;
    new.is_timetable_available := false;
  end if;

  if new.status in (
    'completed'::public.cohort_status,
    'suspended'::public.cohort_status,
    'archived'::public.cohort_status
  ) then
    new.is_timetable_available := false;
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_cohort_completion_lifecycle
on public.cohorts;

create trigger enforce_cohort_completion_lifecycle
before insert or update of
  status,
  expected_completion_date,
  is_timetable_available
on public.cohorts
for each row
execute function public.enforce_cohort_completion_lifecycle();

create or replace function public.reconcile_cohorts_on_period_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    new.status = 'active'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
    )
  then
    perform public.reconcile_expired_cohorts();
  end if;

  return new;
end;
$$;

revoke all
on function public.reconcile_cohorts_on_period_activation()
from public, anon, authenticated;

drop trigger if exists
  reconcile_cohorts_on_period_activation
on public.academic_periods;

create trigger reconcile_cohorts_on_period_activation
after insert or update of status
on public.academic_periods
for each row
execute function public.reconcile_cohorts_on_period_activation();

-- One-time reconciliation of existing stale cohorts.
select public.reconcile_expired_cohorts();
