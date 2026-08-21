-- ============================================================
-- Academic Planner: repair date-only cohort completion
-- ============================================================
--
-- This repairs the immediately preceding cohort lifecycle migration.
--
-- Important:
--   expected_completion_date is a planning/reference date.
--   It must NOT, by itself, change an Active cohort to Completed.
--
-- The previous migration used one transaction-level now() timestamp for
-- every row it changed. This repair detects that most recent batch and
-- reverses only rows changed in that batch.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove the incorrect automatic date-only lifecycle rules first.
-- ------------------------------------------------------------

drop trigger if exists
  reconcile_cohorts_on_period_activation
on public.academic_periods;

drop trigger if exists
  enforce_cohort_completion_lifecycle
on public.cohorts;

drop function if exists
  public.reconcile_cohorts_on_period_activation();

drop function if exists
  public.enforce_cohort_completion_lifecycle();

drop function if exists
  public.reconcile_expired_cohorts();

-- ------------------------------------------------------------
-- 2. Capture the exact most-recent batch changed by the bad migration.
-- ------------------------------------------------------------

create temporary table _cohort_v13_repair (
  id uuid primary key,
  had_timetable_activity boolean not null default false
) on commit drop;

do $$
declare
  bad_batch_ts timestamptz;
begin
  /*
   * The bad migration changed every targeted cohort with the same
   * transaction-level now() value. It was just pushed, so restrict
   * detection to the last 12 hours as an additional safety boundary.
   */
  select max(c.updated_at)
  into bad_batch_ts
  from public.cohorts c
  where c.status = 'completed'::public.cohort_status
    and c.expected_completion_date < current_date
    and c.updated_at >= now() - interval '12 hours';

  if bad_batch_ts is null then
    raise notice
      'No recent date-only cohort completion batch was found. Nothing restored.';
    return;
  end if;

  insert into _cohort_v13_repair (id)
  select c.id
  from public.cohorts c
  where c.status = 'completed'::public.cohort_status
    and c.expected_completion_date < current_date
    and c.updated_at = bad_batch_ts;

  raise notice
    'Repairing % cohort(s) from bad migration timestamp %.',
    (select count(*) from _cohort_v13_repair),
    bad_batch_ts;

  -- ----------------------------------------------------------
  -- 3. Determine which cohorts had timetable records enabled
  --    immediately before the bad migration.
  --
  -- Only records carrying the exact same bad migration timestamp
  -- were disabled by that migration.
  -- ----------------------------------------------------------

  update _cohort_v13_repair r
  set had_timetable_activity = true
  where exists (
    select 1
    from public.unit_offerings uo
    where uo.cohort_id = r.id
      and uo.is_timetable_enabled = false
      and uo.updated_at = bad_batch_ts
  )
  or exists (
    select 1
    from public.teaching_allocations ta
    where ta.cohort_id = r.id
      and ta.is_timetable_enabled = false
      and ta.updated_at = bad_batch_ts
  );

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'participant_cohort_ids'
  ) then
    execute format(
      $sql$
      update _cohort_v13_repair r
      set had_timetable_activity = true
      where exists (
        select 1
        from public.teaching_allocations ta
        where ta.is_timetable_enabled = false
          and ta.updated_at = %L::timestamptz
          and ta.participant_cohort_ids @> array[r.id]::uuid[]
      )
      $sql$,
      bad_batch_ts
    );
  end if;

  -- ----------------------------------------------------------
  -- 4. Restore only timetable records disabled in that exact batch.
  -- ----------------------------------------------------------

  update public.unit_offerings uo
  set
    is_timetable_enabled = true,
    updated_at = now()
  where uo.is_timetable_enabled = false
    and uo.updated_at = bad_batch_ts
    and exists (
      select 1
      from _cohort_v13_repair r
      where r.id = uo.cohort_id
    );

  update public.teaching_allocations ta
  set
    is_timetable_enabled = true,
    updated_at = now()
  where ta.is_timetable_enabled = false
    and ta.updated_at = bad_batch_ts
    and exists (
      select 1
      from _cohort_v13_repair r
      where r.id = ta.cohort_id
    );

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'participant_cohort_ids'
  ) then
    execute format(
      $sql$
      update public.teaching_allocations ta
      set
        is_timetable_enabled = true,
        updated_at = now()
      where ta.is_timetable_enabled = false
        and ta.updated_at = %L::timestamptz
        and exists (
          select 1
          from _cohort_v13_repair r
          where ta.participant_cohort_ids @> array[r.id]::uuid[]
        )
      $sql$,
      bad_batch_ts
    );
  end if;

  -- ----------------------------------------------------------
  -- 5. Restore cohort status.
  --
  -- We know every row in this batch was Active immediately before
  -- the bad migration because that migration selected status=active.
  --
  -- Timetable availability is restored to true only where timetable
  -- activity proves the cohort was participating. Otherwise it remains
  -- false, avoiding an unsafe assumption about its previous toggle.
  -- ----------------------------------------------------------

  update public.cohorts c
  set
    status = 'active'::public.cohort_status,
    is_timetable_available =
      case
        when r.had_timetable_activity then true
        else c.is_timetable_available
      end,
    updated_at = now()
  from _cohort_v13_repair r
  where c.id = r.id;

  raise notice
    'Date-only cohort completion repair finished successfully.';
end;
$$;

-- ------------------------------------------------------------
-- 6. Keep no date-only completion trigger/function after repair.
--    Completion remains under the existing academic progression workflow.
-- ------------------------------------------------------------

comment on column public.cohorts.expected_completion_date is
  'Projected/reference completion date. It does not by itself determine cohort lifecycle status.';
