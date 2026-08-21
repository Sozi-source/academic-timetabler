-- ============================================================
-- Academic Planner
-- Merge all historical and future CND / DND JAN+MAR cohorts
-- ============================================================
--
-- Rule:
--   For CND and DND, January and March intakes of the same year
--   represent one combined cohort from the start.
--
-- This migration:
--   1. Removes the incorrect date-only lifecycle automation.
--   2. Repairs the recent date-only completion batch if present.
--   3. Consolidates ALL historical CND/DND JAN/MAR cohorts by year.
--   4. Canonicalizes future CND/DND JAN/MAR cohort inserts/updates.
--
-- Canonical cohort identity per programme/year:
--   Code: PROGRAMME-JAN-MAR-YYYY
--   Name: PROGRAMME JAN/MAR YY
--
-- Canonical UUID choice:
--   Prefer an existing canonical cohort row if one already exists.
--   Otherwise keep the January row.
--   Otherwise keep the March row.
--
-- Safety:
--   Unknown unresolved FK dependencies will abort the delete step
--   and roll back the entire migration.
-- ============================================================

-- ------------------------------------------------------------
-- A. Remove incorrect expected-completion-date automation.
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

comment on column public.cohorts.expected_completion_date is
  'Projected/reference completion date. Academic progression/status determines actual cohort completion.';

-- ------------------------------------------------------------
-- B. Repair the most recent date-only completion batch if present.
-- ------------------------------------------------------------

do $$
declare
  bad_batch_ts timestamptz;
begin
  select max(c.updated_at)
  into bad_batch_ts
  from public.cohorts c
  where c.status = 'completed'::public.cohort_status
    and c.expected_completion_date < current_date
    and c.updated_at >= now() - interval '48 hours';

  if bad_batch_ts is not null then
    update public.cohorts c
    set
      status = 'active'::public.cohort_status,
      is_timetable_available = true,
      updated_at = now()
    where c.status = 'completed'::public.cohort_status
      and c.expected_completion_date < current_date
      and c.updated_at = bad_batch_ts;

    raise notice
      'Repaired recent date-only completion batch from %.',
      bad_batch_ts;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- C. Internal merge helper.
-- ------------------------------------------------------------

create or replace function public._merge_canonical_cohort(
  p_keeper uuid,
  p_duplicate uuid,
  p_new_code text,
  p_new_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  keeper public.cohorts%rowtype;
  duplicate public.cohorts%rowtype;

  duplicate_offering record;
  keeper_offering_id uuid;

  duplicate_allocation record;
  keeper_allocation_id uuid;
  keeper_allocation_offering_id uuid;
  duplicate_allocation_offering_id uuid;

  merged_status public.cohort_status;
  merged_planned_size integer;
  merged_actual_size integer;
  merged_completion_date date;
  merged_period smallint;
begin
  if p_keeper = p_duplicate then
    return;
  end if;

  select * into keeper
  from public.cohorts
  where id = p_keeper
  for update;

  select * into duplicate
  from public.cohorts
  where id = p_duplicate
  for update;

  if keeper.id is null or duplicate.id is null then
    raise exception 'Canonical cohort merge requires existing keeper and duplicate rows';
  end if;

  if keeper.programme_id <> duplicate.programme_id then
    raise exception 'Cannot merge cohorts from different programmes';
  end if;

  merged_status :=
    case
      when keeper.status = 'active'
        or duplicate.status = 'active'
        then 'active'::public.cohort_status
      when keeper.status = 'planned'
        or duplicate.status = 'planned'
        then 'planned'::public.cohort_status
      when keeper.status = 'suspended'
        or duplicate.status = 'suspended'
        then 'suspended'::public.cohort_status
      when keeper.status = 'completed'
        and duplicate.status = 'completed'
        then 'completed'::public.cohort_status
      else 'archived'::public.cohort_status
    end;

  merged_planned_size :=
    case
      when keeper.planned_size is null
        and duplicate.planned_size is null
        then null
      else coalesce(keeper.planned_size, 0)
         + coalesce(duplicate.planned_size, 0)
    end;

  merged_actual_size :=
    coalesce(keeper.actual_size, 0)
    + coalesce(duplicate.actual_size, 0);

  merged_completion_date :=
    greatest(
      keeper.expected_completion_date,
      duplicate.expected_completion_date
    );

  merged_period :=
    greatest(
      keeper.current_academic_period_number,
      duplicate.current_academic_period_number
    );

  -- Teaching offering participants
  delete from public.teaching_offering_participants dup_participant
  using public.teaching_offering_participants keep_participant
  where dup_participant.cohort_id = p_duplicate
    and keep_participant.cohort_id = p_keeper
    and keep_participant.teaching_offering_id =
        dup_participant.teaching_offering_id;

  update public.teaching_offering_participants participant
  set
    cohort_id = p_keeper,
    updated_at = now()
  where participant.cohort_id = p_duplicate;

  update public.teaching_offering_participants candidate
  set
    is_primary = true,
    updated_at = now()
  where candidate.id in (
    select min(p.id)
    from public.teaching_offering_participants p
    group by p.teaching_offering_id
    having bool_or(p.is_primary) = false
  );

  -- Unit offerings
  for duplicate_offering in
    select uo.*
    from public.unit_offerings uo
    where uo.cohort_id = p_duplicate
    order by uo.created_at, uo.id
  loop
    select keeper_uo.id
    into keeper_offering_id
    from public.unit_offerings keeper_uo
    where keeper_uo.cohort_id = p_keeper
      and keeper_uo.academic_period_id =
          duplicate_offering.academic_period_id
      and keeper_uo.unit_id =
          duplicate_offering.unit_id
    limit 1;

    if keeper_offering_id is null then
      update public.unit_offerings
      set
        cohort_id = p_keeper,
        updated_at = now()
      where id = duplicate_offering.id;
    else
      delete from public.teaching_offering_participants dup_participant
      using public.teaching_offering_participants keep_participant
      where dup_participant.unit_offering_id = duplicate_offering.id
        and keep_participant.unit_offering_id = keeper_offering_id
        and keep_participant.teaching_offering_id =
            dup_participant.teaching_offering_id;

      update public.teaching_offering_participants
      set
        unit_offering_id = keeper_offering_id,
        updated_at = now()
      where unit_offering_id = duplicate_offering.id;

      delete from public.unit_offerings
      where id = duplicate_offering.id;
    end if;

    keeper_offering_id := null;
  end loop;

  -- Teaching allocations
  for duplicate_allocation in
    select ta.*
    from public.teaching_allocations ta
    where ta.cohort_id = p_duplicate
    order by ta.created_at, ta.id
  loop
    select
      keeper_ta.id,
      keeper_ta.teaching_offering_id
    into
      keeper_allocation_id,
      keeper_allocation_offering_id
    from public.teaching_allocations keeper_ta
    where keeper_ta.cohort_id = p_keeper
      and keeper_ta.academic_period_id =
          duplicate_allocation.academic_period_id
      and keeper_ta.unit_id =
          duplicate_allocation.unit_id
    limit 1;

    duplicate_allocation_offering_id :=
      duplicate_allocation.teaching_offering_id;

    if keeper_allocation_id is null then
      update public.teaching_allocations
      set
        cohort_id = p_keeper,
        updated_at = now()
      where id = duplicate_allocation.id;
    else
      if to_regclass('public.scheduled_sessions') is not null then
        update public.scheduled_sessions duplicate_session
        set
          status = 'archived'::public.scheduled_session_status,
          is_locked = false,
          conflict_state = 'unchecked'::public.scheduled_session_conflict_state,
          notes = left(
            concat_ws(
              ' ',
              nullif(trim(duplicate_session.notes), ''),
              'Archived during CND/DND JAN/MAR cohort consolidation.'
            ),
            1000
          ),
          updated_at = now()
        where duplicate_session.teaching_allocation_id =
              duplicate_allocation.id
          and duplicate_session.status not in (
            'cancelled'::public.scheduled_session_status,
            'archived'::public.scheduled_session_status
          )
          and exists (
            select 1
            from public.scheduled_sessions keeper_session
            where keeper_session.teaching_allocation_id =
                  keeper_allocation_id
              and keeper_session.session_number =
                  duplicate_session.session_number
              and keeper_session.status not in (
                'cancelled'::public.scheduled_session_status,
                'archived'::public.scheduled_session_status
              )
          );

        update public.scheduled_sessions
        set
          teaching_allocation_id = keeper_allocation_id,
          cohort_id = p_keeper,
          updated_at = now()
        where teaching_allocation_id = duplicate_allocation.id;
      end if;

      if to_regclass('public.teaching_offerings') is not null then
        if exists (
          select 1
          from public.teaching_offerings offering
          where offering.legacy_teaching_allocation_id =
                keeper_allocation_id
        ) then
          update public.teaching_offerings
          set
            legacy_teaching_allocation_id = null,
            updated_at = now()
          where legacy_teaching_allocation_id =
                duplicate_allocation.id;
        else
          update public.teaching_offerings
          set
            legacy_teaching_allocation_id =
              keeper_allocation_id,
            updated_at = now()
          where legacy_teaching_allocation_id =
                duplicate_allocation.id;
        end if;
      end if;

      if keeper_allocation_offering_id is null
         and duplicate_allocation_offering_id is not null
      then
        update public.teaching_allocations
        set
          teaching_offering_id = duplicate_allocation_offering_id,
          updated_at = now()
        where id = keeper_allocation_id;
      end if;

      update public.teaching_allocations keeper_ta
      set
        is_timetable_enabled =
          keeper_ta.is_timetable_enabled
          or duplicate_allocation.is_timetable_enabled,
        status =
          case
            when keeper_ta.status = 'active'
              or duplicate_allocation.status = 'active'
              then 'active'::public.teaching_allocation_status
            when keeper_ta.status = 'draft'
              or duplicate_allocation.status = 'draft'
              then 'draft'::public.teaching_allocation_status
            else keeper_ta.status
          end,
        notes = left(
          concat_ws(
            ' ',
            nullif(trim(keeper_ta.notes), ''),
            nullif(trim(duplicate_allocation.notes), ''),
            'CND/DND JAN/MAR cohort allocation consolidated.'
          ),
          1500
        ),
        updated_at = now()
      where keeper_ta.id = keeper_allocation_id;

      delete from public.teaching_allocations
      where id = duplicate_allocation.id;
    end if;

    keeper_allocation_id := null;
    keeper_allocation_offering_id := null;
    duplicate_allocation_offering_id := null;
  end loop;

  if to_regclass('public.scheduled_sessions') is not null then
    update public.scheduled_sessions
    set
      cohort_id = p_keeper,
      updated_at = now()
    where cohort_id = p_duplicate;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'participant_cohort_ids'
  ) then
    execute $sql$
      update public.teaching_allocations ta
      set
        participant_cohort_ids = (
          select array_agg(distinct mapped_id order by mapped_id)
          from (
            select
              case
                when cohort_id = $1 then $2
                else cohort_id
              end as mapped_id
            from unnest(
              coalesce(ta.participant_cohort_ids, '{}'::uuid[])
            ) cohort_id
          ) mapped
        ),
        updated_at = now()
      where $1 = any(coalesce(ta.participant_cohort_ids, '{}'::uuid[]))
    $sql$
    using p_duplicate, p_keeper;
  end if;

  if to_regclass('public.scheduling_constraints') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'scheduling_constraints'
         and column_name = 'subject_id'
     )
  then
    update public.scheduling_constraints
    set
      subject_id = p_keeper,
      updated_at = now()
    where subject_type = 'cohort'
      and subject_id = p_duplicate;
  end if;

  update public.cohorts
  set
    code = p_new_code,
    name = p_new_name,
    intake_date = least(keeper.intake_date, duplicate.intake_date),
    expected_completion_date = merged_completion_date,
    current_academic_period_number = merged_period,
    planned_size = merged_planned_size,
    actual_size = merged_actual_size,
    status = merged_status,
    is_timetable_available =
      case
        when merged_status in (
          'active'::public.cohort_status,
          'planned'::public.cohort_status
        )
        then true
        else false
      end,
    notes = left(
      concat_ws(
        ' ',
        nullif(trim(keeper.notes), ''),
        nullif(trim(duplicate.notes), ''),
        'January and March intakes consolidated into one canonical cohort.'
      ),
      1500
    ),
    updated_at = now()
  where id = p_keeper;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'combined_cohort_size'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teaching_allocations'
      and column_name = 'participant_cohort_ids'
  ) then
    execute $sql$
      update public.teaching_allocations ta
      set
        combined_cohort_size = (
          select coalesce(sum(c.actual_size), 0)
          from public.cohorts c
          where c.id = any(
            coalesce(
              ta.participant_cohort_ids,
              array[ta.cohort_id]::uuid[]
            )
          )
        ),
        updated_at = now()
      where ta.cohort_id = $1
         or $1 = any(
           coalesce(ta.participant_cohort_ids, '{}'::uuid[])
         )
    $sql$
    using p_keeper;
  end if;

  delete from public.cohorts
  where id = p_duplicate;
end;
$$;

revoke all
on function public._merge_canonical_cohort(uuid, uuid, text, text)
from public, anon, authenticated;

-- ------------------------------------------------------------
-- D. Year-level canonicalizer.
-- ------------------------------------------------------------

create or replace function public._canonicalize_cnd_dnd_year(
  p_programme_id uuid,
  p_programme_code text,
  p_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_code text;
  canonical_name text;
  keeper_id uuid;
  keeper_exists boolean := false;
  candidate_id uuid;
  jan_count integer;
  mar_count integer;
  canonical_count integer;
begin
  canonical_code :=
    upper(trim(p_programme_code)) || '-JAN-MAR-' || p_year::text;

  canonical_name :=
    upper(trim(p_programme_code)) || ' JAN/MAR '
    || right(p_year::text, 2);

  select count(*)
  into jan_count
  from public.cohorts c
  where c.programme_id = p_programme_id
    and extract(year from c.intake_date) = p_year
    and extract(month from c.intake_date) = 1;

  select count(*)
  into mar_count
  from public.cohorts c
  where c.programme_id = p_programme_id
    and extract(year from c.intake_date) = p_year
    and extract(month from c.intake_date) = 3;

  select count(*)
  into canonical_count
  from public.cohorts c
  where c.programme_id = p_programme_id
    and (
      lower(trim(c.code)) = lower(trim(canonical_code))
      or lower(trim(c.name)) = lower(trim(canonical_name))
    );

  if jan_count > 1 or mar_count > 1 or canonical_count > 1 then
    raise exception
      'Ambiguous CND/DND cohort set for % % (JAN=% MAR=% CANONICAL=%)',
      p_programme_code,
      p_year,
      jan_count,
      mar_count,
      canonical_count;
  end if;

  -- Choose keeper: canonical > January > March
  select c.id
  into keeper_id
  from public.cohorts c
  where c.programme_id = p_programme_id
    and (
      lower(trim(c.code)) = lower(trim(canonical_code))
      or lower(trim(c.name)) = lower(trim(canonical_name))
    )
  order by c.created_at, c.id
  limit 1;

  if keeper_id is not null then
    keeper_exists := true;
  else
    select c.id
    into keeper_id
    from public.cohorts c
    where c.programme_id = p_programme_id
      and extract(year from c.intake_date) = p_year
      and extract(month from c.intake_date) = 1
    order by c.created_at, c.id
    limit 1;

    if keeper_id is not null then
      keeper_exists := true;
    else
      select c.id
      into keeper_id
      from public.cohorts c
      where c.programme_id = p_programme_id
        and extract(year from c.intake_date) = p_year
        and extract(month from c.intake_date) = 3
      order by c.created_at, c.id
      limit 1;

      keeper_exists := keeper_id is not null;
    end if;
  end if;

  if not keeper_exists then
    return;
  end if;

  -- Merge every other related row of that programme/year.
  for candidate_id in
    select c.id
    from public.cohorts c
    where c.id <> keeper_id
      and c.programme_id = p_programme_id
      and (
        extract(year from c.intake_date) = p_year
        and extract(month from c.intake_date) in (1, 3)
        or lower(trim(c.code)) = lower(trim(canonical_code))
        or lower(trim(c.name)) = lower(trim(canonical_name))
      )
    order by c.created_at, c.id
  loop
    perform public._merge_canonical_cohort(
      keeper_id,
      candidate_id,
      canonical_code,
      canonical_name
    );
  end loop;

  -- Canonicalize the keeper even if there was only one row.
  update public.cohorts
  set
    code = canonical_code,
    name = canonical_name,
    updated_at = now()
  where id = keeper_id;
end;
$$;

revoke all
on function public._canonicalize_cnd_dnd_year(uuid, text, integer)
from public, anon, authenticated;

-- ------------------------------------------------------------
-- E. Canonicalize all historical CND/DND years.
-- ------------------------------------------------------------

do $$
declare
  programme_record record;
  year_record record;
begin
  for programme_record in
    select p.id, upper(trim(p.code)) as code
    from public.programmes p
    where upper(trim(p.code)) in ('CND', 'DND')
    order by p.code
  loop
    for year_record in
      select distinct
        extract(year from c.intake_date)::int as intake_year
      from public.cohorts c
      where c.programme_id = programme_record.id
        and (
          extract(month from c.intake_date) in (1, 3)
          or lower(trim(c.code)) =
             lower(programme_record.code || '-JAN-MAR-' ||
                   extract(year from c.intake_date)::int::text)
          or lower(trim(c.name)) like
             lower(programme_record.code || ' jan/mar %')
        )
      order by intake_year
    loop
      perform public._canonicalize_cnd_dnd_year(
        programme_record.id,
        programme_record.code,
        year_record.intake_year
      );
    end loop;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- F. Future guard: CND/DND Jan/Mar cohorts must stay combined.
-- ------------------------------------------------------------

create or replace function public.enforce_cnd_dnd_combined_cohort()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  programme_code text;
  cohort_year integer;
  canonical_code text;
  canonical_name text;
  existing_id uuid;
begin
  select upper(trim(p.code))
  into programme_code
  from public.programmes p
  where p.id = new.programme_id;

  if programme_code not in ('CND', 'DND') then
    return new;
  end if;

  cohort_year := extract(year from new.intake_date)::int;

  if extract(month from new.intake_date) not in (1, 3) then
    return new;
  end if;

  canonical_code :=
    programme_code || '-JAN-MAR-' || cohort_year::text;

  canonical_name :=
    programme_code || ' JAN/MAR ' || right(cohort_year::text, 2);

  new.code := canonical_code;
  new.name := canonical_name;

  select c.id
  into existing_id
  from public.cohorts c
  where c.programme_id = new.programme_id
    and extract(year from c.intake_date) = cohort_year
    and c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  order by
    case
      when lower(trim(c.code)) = lower(trim(canonical_code)) then 0
      when extract(month from c.intake_date) = 1 then 1
      when extract(month from c.intake_date) = 3 then 2
      else 3
    end,
    c.created_at,
    c.id
  limit 1;

  if existing_id is not null then
    raise exception
      'CND/DND January and March intakes are combined. Reuse the existing cohort "%" for %.',
      canonical_name,
      cohort_year;
  end if;

  return new;
end;
$$;

revoke all
on function public.enforce_cnd_dnd_combined_cohort()
from public, anon, authenticated;

drop trigger if exists
  enforce_cnd_dnd_combined_cohort
on public.cohorts;

create trigger enforce_cnd_dnd_combined_cohort
before insert or update of
  programme_id,
  intake_date,
  code,
  name
on public.cohorts
for each row
execute function public.enforce_cnd_dnd_combined_cohort();

-- ------------------------------------------------------------
-- G. Cleanup helper functions.
-- ------------------------------------------------------------

drop function public._canonicalize_cnd_dnd_year(uuid, text, integer);
drop function public._merge_canonical_cohort(uuid, uuid, text, text);

-- ------------------------------------------------------------
-- H. Final verification.
-- ------------------------------------------------------------

do $$
declare
  programme_record record;
  duplicate_year record;
begin
  for programme_record in
    select p.id, upper(trim(p.code)) as code
    from public.programmes p
    where upper(trim(p.code)) in ('CND', 'DND')
  loop
    for duplicate_year in
      select
        extract(year from c.intake_date)::int as intake_year,
        count(*) filter (
          where extract(month from c.intake_date) in (1, 3)
        ) as jan_mar_rows
      from public.cohorts c
      where c.programme_id = programme_record.id
      group by extract(year from c.intake_date)::int
      having count(*) filter (
        where extract(month from c.intake_date) in (1, 3)
      ) > 1
    loop
      raise exception
        'Separate JAN/MAR rows remain for % %',
        programme_record.code,
        duplicate_year.intake_year;
    end loop;
  end loop;
end;
$$;
