-- ============================================================
-- Academic Planner
-- Exact JAN/MAR cohort consolidation repair
-- Based on verified remote cohort UUIDs on 2026-08-21.
-- ============================================================

-- Expected completion is advisory only.
drop trigger if exists reconcile_cohorts_on_period_activation
on public.academic_periods;

drop trigger if exists enforce_cohort_completion_lifecycle
on public.cohorts;

drop function if exists public.reconcile_cohorts_on_period_activation();
drop function if exists public.enforce_cohort_completion_lifecycle();
drop function if exists public.reconcile_expired_cohorts();

-- Remove experimental JAN/MAR triggers from earlier attempts.
drop trigger if exists enforce_cnd_dnd_combined_cohort
on public.cohorts;

drop trigger if exists enforce_combined_jan_mar_cohort
on public.cohorts;

drop trigger if exists enforce_universal_jan_mar_cohort
on public.cohorts;

drop function if exists public.enforce_cnd_dnd_combined_cohort();
drop function if exists public.enforce_combined_jan_mar_cohort();
drop function if exists public.enforce_universal_jan_mar_cohort();

comment on column public.cohorts.expected_completion_date is
  'Projected/reference completion date. Academic progression/status determines actual cohort completion.';

-- ------------------------------------------------------------
-- Merge plan.
--
-- mode = combined
--   A real January + March pair exists. Keep one canonical
--   JAN/MAR cohort.
--
-- mode = january
--   No March intake exists. Remove the false JAN/MAR duplicate
--   and retain the real January cohort.
-- ------------------------------------------------------------

create temporary table _jan_mar_merge_plan (
  keeper_id uuid not null,
  duplicate_id uuid not null,
  final_code text not null,
  final_name text not null,
  mode text not null
    check (mode in ('combined', 'january')),
  primary key (duplicate_id)
) on commit drop;

insert into _jan_mar_merge_plan (
  keeper_id,
  duplicate_id,
  final_code,
  final_name,
  mode
)
values
  -- CCA 2023: JAN + existing JAN/MAR + MAR
  ('b7d5c299-de63-461b-99b3-5aa5ea18ee9c',
   '747d874b-402e-4b6d-8d1c-b1df9595f2bd',
   'CCA-JAN-MAR-2023', 'CCA JAN/MAR 23', 'combined'),
  ('b7d5c299-de63-461b-99b3-5aa5ea18ee9c',
   'ca7cbf29-8076-4408-8961-1f5ff8c7cfa0',
   'CCA-JAN-MAR-2023', 'CCA JAN/MAR 23', 'combined'),

  -- CHN 2021
  ('de08afdc-dfa1-4ccc-a552-5d816958c089',
   'fbbd8d11-7870-43b2-8965-ed5d402e3451',
   'CHN-JAN-MAR-2021', 'CHN JAN/MAR 21', 'combined'),
  ('de08afdc-dfa1-4ccc-a552-5d816958c089',
   'd6a27b33-fd08-49c4-a8f5-fd87e0455c67',
   'CHN-JAN-MAR-2021', 'CHN JAN/MAR 21', 'combined'),

  -- CHN 2022
  ('cb6c440c-ce66-44ef-a0d9-95cb4dfc8285',
   '62dde3f0-10e0-4c3c-8f0f-be3be10262a7',
   'CHN-JAN-MAR-2022', 'CHN JAN/MAR 22', 'combined'),
  ('cb6c440c-ce66-44ef-a0d9-95cb4dfc8285',
   '5c6ae7a3-03f1-4c0f-819e-8a928a3877d2',
   'CHN-JAN-MAR-2022', 'CHN JAN/MAR 22', 'combined'),

  -- CHN 2023
  ('4d1ca5af-162e-4bd3-87a1-10b4dce797d4',
   '318f48bb-bf8f-4646-9a48-8a19bab4c25b',
   'CHN-JAN-MAR-2023', 'CHN JAN/MAR 23', 'combined'),
  ('4d1ca5af-162e-4bd3-87a1-10b4dce797d4',
   '117dfbef-5919-441c-a4c9-5919366bafa3',
   'CHN-JAN-MAR-2023', 'CHN JAN/MAR 23', 'combined'),

  -- CHN 2024
  ('c2fd106a-0341-4ec1-8910-8244511fff5c',
   'e1fcaff8-2e9f-406f-8d55-c7564333c633',
   'CHN-JAN-MAR-2024', 'CHN JAN/MAR 24', 'combined'),
  ('c2fd106a-0341-4ec1-8910-8244511fff5c',
   '8b6676c5-318f-4474-9493-897e86a05c79',
   'CHN-JAN-MAR-2024', 'CHN JAN/MAR 24', 'combined'),

  -- CHN 2025: keep the timetable-active canonical row
  ('a6555043-e857-45d2-a186-b28c6dc8c671',
   'c1959e2b-3472-4f9c-85c2-9e6f577d7227',
   'CHN-JAN-MAR-2025', 'CHN JAN/MAR 25', 'combined'),
  ('a6555043-e857-45d2-a186-b28c6dc8c671',
   'd27dc354-2ead-47c2-9020-2b32e3cb6ebd',
   'CHN-JAN-MAR-2025', 'CHN JAN/MAR 25', 'combined'),

  -- DHN 2023
  ('996df383-19a9-478a-8e9c-d7a2d71c643f',
   '5c940132-1878-4025-8d4c-8cb615a9387f',
   'DHN-JAN-MAR-2023', 'DHN JAN/MAR 23', 'combined'),
  ('996df383-19a9-478a-8e9c-d7a2d71c643f',
   '2a38abb9-229d-488e-95c9-f821addf6fa3',
   'DHN-JAN-MAR-2023', 'DHN JAN/MAR 23', 'combined'),

  -- DHN 2024
  ('dbb8b093-3f04-4230-8445-b5f186e970e3',
   '66422359-d880-44c0-8308-b2d496403614',
   'DHN-JAN-MAR-2024', 'DHN JAN/MAR 24', 'combined'),
  ('dbb8b093-3f04-4230-8445-b5f186e970e3',
   '1c5dd3bf-c115-401c-abbe-4e8a6aabf0d7',
   'DHN-JAN-MAR-2024', 'DHN JAN/MAR 24', 'combined'),

  -- DHN 2025: existing active row already represents the combined cohort
  ('202e4b38-4aea-452b-afb9-f795d119be21',
   '7d1f2f2b-6dcb-4f6f-97f5-49de9ab2f6b7',
   'DHN-JAN-MAR-2025', 'DHN JAN/MAR 25', 'combined'),

  -- FALSE JAN/MAR RECORDS: no March cohort exists.
  -- DFP 2024
  ('d78339fc-e646-4ef8-8eb2-5847c848f7a9',
   '8c9f8c1c-f27c-4f1f-a3b4-0e78a623e31c',
   'DFP-JAN-2024', 'DFP JAN 24', 'january'),

  -- DHNT 2024
  ('44f33bf7-078c-4aa6-8c6b-89ad60e044a5',
   'c0bd7891-0bac-43c7-832b-b4a74a348397',
   'DHNT-JAN-2024', 'DHNT JAN 24', 'january'),

  -- DHNT 2025
  ('2dbb2f49-9273-46ba-9449-7747822d3c7d',
   '6a792cc5-ce3f-49ef-b161-7fcb1db7e650',
   'DHNT-JAN-2025', 'DHNT JAN 25', 'january'),

  -- DHNT 2026
  ('d91ba401-3bd4-4688-a22b-0608de8dbb75',
   '461a3cb1-f26f-4d64-a0a9-5cd7d1157ab7',
   'DHNT-JAN-2026', 'DHNT JAN 26', 'january'),

  -- DNDT 2026: keep the real active/timetable-available January row
  ('97ee96de-00b6-40ee-bcdf-9d79a004dd8e',
   '33a7beac-c6e5-4c21-9549-81983245b13c',
   'DNDT-JAN-2026', 'DNDT JAN 26', 'january');

-- ------------------------------------------------------------
-- Verify the exact remote IDs before changing anything.
-- ------------------------------------------------------------

do $$
declare
  bad record;
begin
  for bad in
    select plan.*
    from _jan_mar_merge_plan plan
    left join public.cohorts keeper
      on keeper.id = plan.keeper_id
    left join public.cohorts duplicate
      on duplicate.id = plan.duplicate_id
    where keeper.id is null
       or duplicate.id is null
       or keeper.programme_id <> duplicate.programme_id
  loop
    raise exception
      'JAN/MAR repair preflight failed for keeper % duplicate %',
      bad.keeper_id,
      bad.duplicate_id;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Merge helper.
-- ------------------------------------------------------------

create or replace function public._repair_merge_cohort_rows(
  p_keeper uuid,
  p_duplicate uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  duplicate_offering record;
  keeper_offering_id uuid;

  duplicate_allocation record;
  keeper_allocation_id uuid;
  keeper_allocation_offering_id uuid;
  duplicate_allocation_offering_id uuid;

  cohort_reference record;
  unhandled_cohort_fks text;
begin
  if p_keeper = p_duplicate then
    return;
  end if;

  if not exists (
    select 1
    from public.cohorts
    where id = p_duplicate
  ) then
    return;
  end if;

  if not exists (
    select 1
    from public.cohorts
    where id = p_keeper
  ) then
    raise exception 'Cohort merge keeper % does not exist', p_keeper;
  end if;

  if (
    select programme_id
    from public.cohorts
    where id = p_keeper
  ) <> (
    select programme_id
    from public.cohorts
    where id = p_duplicate
  ) then
    raise exception
      'Cannot merge cohorts from different programmes: % -> %',
      p_duplicate,
      p_keeper;
  end if;

  -- ----------------------------------------------------------
  -- Shared teaching offering participants.
  -- ----------------------------------------------------------

  delete from public.teaching_offering_participants dup_participant
  using public.teaching_offering_participants keep_participant
  where dup_participant.cohort_id = p_duplicate
    and keep_participant.cohort_id = p_keeper
    and keep_participant.teaching_offering_id =
        dup_participant.teaching_offering_id;

  update public.teaching_offering_participants
  set
    cohort_id = p_keeper,
    updated_at = now()
  where cohort_id = p_duplicate;

  -- If consolidation removed the only primary participant,
  -- choose the oldest remaining participant.
  update public.teaching_offering_participants candidate
  set
    is_primary = true,
    updated_at = now()
  where candidate.id in (
    select distinct on (p.teaching_offering_id)
      p.id
    from public.teaching_offering_participants p
    where not exists (
      select 1
      from public.teaching_offering_participants primary_participant
      where primary_participant.teaching_offering_id =
            p.teaching_offering_id
        and primary_participant.is_primary = true
    )
    order by
      p.teaching_offering_id,
      p.created_at,
      p.id
  );

  -- ----------------------------------------------------------
  -- Units on Offer.
  -- Unique rule: Academic Period + cohort + unit.
  -- ----------------------------------------------------------

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

  -- ----------------------------------------------------------
  -- Teaching allocations.
  -- Unique rule: Academic Period + cohort + unit.
  -- ----------------------------------------------------------

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
        -- Archive only active session collisions first.
        update public.scheduled_sessions duplicate_session
        set
          status = 'archived'::public.scheduled_session_status,
          is_locked = false,
          conflict_state =
            'unchecked'::public.scheduled_session_conflict_state,
          notes = left(
            concat_ws(
              ' ',
              nullif(trim(duplicate_session.notes), ''),
              'Archived during JAN/MAR cohort consolidation.'
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
        where teaching_allocation_id =
              duplicate_allocation.id;
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
          teaching_offering_id =
            duplicate_allocation_offering_id,
          updated_at = now()
        where id = keeper_allocation_id;
      end if;

      update public.teaching_allocations keeper_ta
      set
        is_timetable_enabled =
          keeper_ta.is_timetable_enabled
          or duplicate_allocation.is_timetable_enabled,
        notes = left(
          concat_ws(
            ' ',
            nullif(trim(keeper_ta.notes), ''),
            nullif(trim(duplicate_allocation.notes), ''),
            'JAN/MAR cohort allocation consolidated.'
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

  -- ----------------------------------------------------------
  -- Students.
  -- ----------------------------------------------------------

  update public.students
  set admission_cohort_id = p_keeper
  where admission_cohort_id = p_duplicate;

  update public.students
  set current_cohort_id = p_keeper
  where current_cohort_id = p_duplicate;

  -- ----------------------------------------------------------
  -- Internal lifecycle transfers between rows that are now the
  -- same cohort become meaningless and may violate a from<>to
  -- check after remapping.
  -- ----------------------------------------------------------

  if to_regclass('public.student_lifecycle_events') is not null then
    delete from public.student_lifecycle_events
    where from_cohort_id in (p_keeper, p_duplicate)
      and to_cohort_id in (p_keeper, p_duplicate);
  end if;

  -- ----------------------------------------------------------
  -- Remaining academic-history cohort references.
  -- Rows are preserved; only the cohort UUID is redirected.
  -- ----------------------------------------------------------

  for cohort_reference in
    select *
    from (
      values
        ('assessment_events', 'cohort_id'),
        ('assessment_mark_import_rows', 'cohort_id'),
        ('assessment_population', 'cohort_id'),
        ('assessment_results', 'cohort_id'),
        ('student_academic_period_enrolments', 'cohort_id'),
        ('student_cohort_assignments', 'cohort_id'),
        ('student_lifecycle_events', 'from_cohort_id'),
        ('student_lifecycle_events', 'to_cohort_id'),
        ('student_stage_progression_events', 'cohort_id'),
        ('student_unit_registration_submissions', 'cohort_id'),
        ('student_unit_registrations', 'cohort_id')
    ) as refs(table_name, column_name)
  loop
    if to_regclass(
         format('public.%I', cohort_reference.table_name)
       ) is not null
       and exists (
         select 1
         from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = cohort_reference.table_name
           and c.column_name = cohort_reference.column_name
       )
    then
      execute format(
        'update public.%I set %I = $1 where %I = $2',
        cohort_reference.table_name,
        cohort_reference.column_name,
        cohort_reference.column_name
      )
      using p_keeper, p_duplicate;
    end if;
  end loop;

  -- ----------------------------------------------------------
  -- Shared participant UUID arrays.
  -- ----------------------------------------------------------

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
      where $1 = any(
        coalesce(ta.participant_cohort_ids, '{}'::uuid[])
      )
    $sql$
    using p_duplicate, p_keeper;
  end if;

  -- Cohort constraints use logical subject IDs.
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

  -- ----------------------------------------------------------
  -- Detect every unknown direct FK before deletion.
  -- ----------------------------------------------------------

  select string_agg(
    format(
      '%I.%I(%I) [%s]',
      source_schema.nspname,
      source_table.relname,
      source_column.attname,
      fk.conname
    ),
    ', '
    order by
      source_schema.nspname,
      source_table.relname,
      source_column.attname
  )
  into unhandled_cohort_fks
  from pg_constraint fk
  join pg_class source_table
    on source_table.oid = fk.conrelid
  join pg_namespace source_schema
    on source_schema.oid = source_table.relnamespace
  join pg_class target_table
    on target_table.oid = fk.confrelid
  join pg_namespace target_schema
    on target_schema.oid = target_table.relnamespace
  join unnest(fk.conkey) with ordinality
    as source_key(attnum, ordinality)
    on true
  join unnest(fk.confkey) with ordinality
    as target_key(attnum, ordinality)
    on target_key.ordinality = source_key.ordinality
  join pg_attribute source_column
    on source_column.attrelid = source_table.oid
   and source_column.attnum = source_key.attnum
  join pg_attribute target_column
    on target_column.attrelid = target_table.oid
   and target_column.attnum = target_key.attnum
  where fk.contype = 'f'
    and target_schema.nspname = 'public'
    and target_table.relname = 'cohorts'
    and target_column.attname = 'id'
    and not (
      source_schema.nspname = 'public'
      and (
        (source_table.relname = 'unit_offerings'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'teaching_allocations'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'scheduled_sessions'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'teaching_offering_participants'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'students'
           and source_column.attname in (
             'admission_cohort_id',
             'current_cohort_id'
           ))
        or
        (source_table.relname = 'assessment_events'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'assessment_mark_import_rows'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'assessment_population'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'assessment_results'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'student_academic_period_enrolments'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'student_cohort_assignments'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'student_lifecycle_events'
           and source_column.attname in (
             'from_cohort_id',
             'to_cohort_id'
           ))
        or
        (source_table.relname = 'student_stage_progression_events'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname =
           'student_unit_registration_submissions'
           and source_column.attname = 'cohort_id')
        or
        (source_table.relname = 'student_unit_registrations'
           and source_column.attname = 'cohort_id')
      )
    );

  if unhandled_cohort_fks is not null then
    raise exception
      'Unhandled direct cohort foreign keys: %',
      unhandled_cohort_fks;
  end if;

  delete from public.cohorts
  where id = p_duplicate;
end;
$$;

revoke all
on function public._repair_merge_cohort_rows(uuid, uuid)
from public, anon, authenticated;

-- ------------------------------------------------------------
-- Execute the exact verified merge plan.
-- ------------------------------------------------------------

do $$
declare
  item record;
begin
  for item in
    select *
    from _jan_mar_merge_plan
    order by
      keeper_id,
      duplicate_id
  loop
    perform public._repair_merge_cohort_rows(
      item.keeper_id,
      item.duplicate_id
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Apply the final correct labels.
-- ------------------------------------------------------------

update public.cohorts keeper
set
  code = final_rows.final_code,
  name = final_rows.final_name,
  updated_at = now()
from (
  select distinct
    keeper_id,
    final_code,
    final_name
  from _jan_mar_merge_plan
) final_rows
where keeper.id = final_rows.keeper_id;

-- CND/DND 2026 were already correctly consolidated.
update public.cohorts
set
  code = 'CND-JAN-MAR-2026',
  name = 'CND JAN/MAR 26',
  updated_at = now()
where id = 'c94e9132-8134-43c2-9baa-0204d4454714';

update public.cohorts
set
  code = 'DND-JAN-MAR-2026',
  name = 'DND JAN/MAR 26',
  updated_at = now()
where id = 'de05c7af-17ed-41db-9fad-3f9e1aad4965';

-- Recalculate actual size from current student ownership when it
-- provides a stronger value than the stored count.
update public.cohorts c
set
  actual_size = greatest(
    c.actual_size,
    student_counts.student_count
  ),
  updated_at = now()
from (
  select
    current_cohort_id as cohort_id,
    count(*)::integer as student_count
  from public.students
  where current_cohort_id is not null
  group by current_cohort_id
) student_counts
where c.id = student_counts.cohort_id;

-- ------------------------------------------------------------
-- Final verification.
-- ------------------------------------------------------------

do $$
declare
  remaining_duplicate uuid;
begin
  select plan.duplicate_id
  into remaining_duplicate
  from _jan_mar_merge_plan plan
  join public.cohorts c
    on c.id = plan.duplicate_id
  limit 1;

  if remaining_duplicate is not null then
    raise exception
      'Duplicate cohort % still exists after JAN/MAR repair',
      remaining_duplicate;
  end if;

  -- These programmes/years have verified real March intakes and
  -- must now contain only the combined canonical row.
  if exists (
    select 1
    from public.cohorts c
    join public.programmes p
      on p.id = c.programme_id
    where (
      (p.code = 'CCA' and extract(year from c.intake_date) = 2023)
      or
      (p.code = 'CHN' and extract(year from c.intake_date)
         between 2021 and 2025)
      or
      (p.code = 'DHN' and extract(year from c.intake_date)
         between 2023 and 2025)
    )
    and (
      upper(c.name) not like '%JAN/MAR%'
      and extract(month from c.intake_date) in (1, 3)
    )
  ) then
    raise exception
      'A verified JAN/MAR pair still has a separate JAN or MAR row';
  end if;

  -- These verified no-March groups must not retain JAN/MAR labels.
  if exists (
    select 1
    from public.cohorts c
    join public.programmes p
      on p.id = c.programme_id
    where (
      (p.code = 'DFP' and extract(year from c.intake_date) = 2024)
      or
      (p.code = 'DHNT' and extract(year from c.intake_date)
         between 2024 and 2026)
      or
      (p.code = 'DNDT' and extract(year from c.intake_date) = 2026)
    )
    and (
      upper(c.name) like '%JAN/MAR%'
      or upper(c.code) like '%JAN-MAR%'
    )
  ) then
    raise exception
      'A no-March cohort still has a JAN/MAR label';
  end if;
end;
$$;

drop function public._repair_merge_cohort_rows(uuid, uuid);