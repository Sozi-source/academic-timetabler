begin;

-- ============================================================================
-- Migration: Purge pre-generated unit markbooks for September-December 2026.
--
-- Why:
--   Bulk pre-generating unit markbooks for all allocated units in advance created
--   91 markbook entries (over 50 of which have 0 students registered).
--   This caused:
--     1. Stale rosters that do not track ongoing student unit registrations.
--     2. Clutter and confusion across assessment control centers.
--
-- Policy:
--   Markbooks are generated on-demand only when trainers enter/submit marks.
--   This migration purges all pre-generated unit markbook events and their
--   child tables for the active period, resetting the assessment events list.
-- ============================================================================

do $$
declare
  target_period_id uuid;
  deleted_events_count integer := 0;
  dependent_reference record;
begin
  -- 1. Identify the academic period (September-December 2026 or active)
  select id into target_period_id
  from public.academic_periods
  where name ilike '%September%2026%'
     or status = 'active'
  order by (name ilike '%September%2026%') desc, (status = 'active') desc, starts_on desc
  limit 1;

  if target_period_id is null then
    raise notice 'No target academic period found for markbook purge.';
    return;
  end if;

  -- 2. Select all pre-generated Unit Markbook assessment events for this period
  -- that are not finalised/archived.
  create temp table temp_purge_event_ids on commit drop as
  select ae.id
  from public.assessment_events ae
  where ae.academic_period_id = target_period_id
    and ae.title = 'Unit Markbook'
    and ae.assessment_type = 'exam'
    and ae.exam_marks_finalized_at is null
    and ae.status <> 'closed'
    and not exists (
      select 1 from public.assessment_event_workspace workspace
      where workspace.id = ae.id
        and workspace.workflow_status in ('finalised', 'archived')
    );

  -- 3. Delete secondary child tables (tables referencing parent batches/tables first):
  if to_regclass('public.assessment_mark_import_batches') is not null then
    delete from public.assessment_mark_import_rows
    where batch_id in (
      select id from public.assessment_mark_import_batches
      where assessment_event_id in (select id from temp_purge_event_ids)
    );
  end if;

  -- 3a. Explicitly delete known markbook generations (audits)
  if to_regclass('public.assessment_markbook_generations') is not null then
    delete from public.assessment_markbook_generations
    where root_assessment_id in (select id from temp_purge_event_ids);
  end if;

  if to_regclass('public.assessment_markbook_generation_audits') is not null then
    delete from public.assessment_markbook_generation_audits
    where assessment_id in (select id from temp_purge_event_ids);
  end if;

  -- 3b. Dynamically delete from ANY child table referencing public.assessment_events(id)
  for dependent_reference in
    select
      child_table.relname as table_name,
      child_attribute.attname as column_name
    from pg_constraint constraint_row
    join pg_class child_table
      on child_table.oid = constraint_row.conrelid
    join pg_namespace child_namespace
      on child_namespace.oid = child_table.relnamespace
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.assessment_events'::regclass
      and child_namespace.nspname = 'public'
      and parent_attribute.attname = 'id'
  loop
    execute format(
      'delete from public.%I where %I in (select id from temp_purge_event_ids)',
      dependent_reference.table_name,
      dependent_reference.column_name
    );
  end loop;

  -- 4. Delete the assessment_events themselves
  delete from public.assessment_events
  where id in (select id from temp_purge_event_ids);

  get diagnostics deleted_events_count = row_count;

  raise notice 'Successfully purged % pre-generated unit markbook events for academic period %.',
    deleted_events_count, target_period_id;
end;
$$;

commit;
