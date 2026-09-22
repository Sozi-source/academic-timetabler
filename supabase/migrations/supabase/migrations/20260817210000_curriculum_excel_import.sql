-- ============================================================
-- v12.8 — Authoritative Curriculum Excel Import
-- ============================================================

alter type public.import_entity_type
add value if not exists 'curriculum';

create or replace function public.import_valid_curriculum_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged_row public.import_rows%rowtype;
  normalized jsonb;
  programme_id_value uuid;
  unit_id_value uuid;
  stage_id_value uuid;
  stage_number_value integer;
  stage_name_value text;
  imported_total integer := 0;
  skipped_total integer := 0;
  failed_total integer := 0;
begin
  select *
  into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using errcode = 'P0002', message = 'Curriculum import batch not found';
  end if;

  if selected_batch.entity_type <> 'curriculum' then
    raise exception using errcode = 'P0001', message = 'Selected batch is not a Curriculum import';
  end if;

  if selected_batch.status <> 'validated' then
    raise exception using errcode = 'P0001', message = 'Only validated Curriculum batches can be imported';
  end if;

  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to import this curriculum';
  end if;

  if exists (
    select 1
    from public.import_rows
    where import_batch_id = target_batch_id
      and status in ('invalid','duplicate')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Resolve every invalid or duplicate curriculum row before import';
  end if;

  update public.import_batches
  set status = 'importing',
      started_at = coalesce(started_at, now()),
      failure_message = null,
      updated_at = now()
  where id = target_batch_id;

  for staged_row in
    select *
    from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized := staged_row.normalized_data;
    programme_id_value := (normalized ->> 'programmeId')::uuid;
    stage_number_value := (normalized ->> 'stageNumber')::integer;
    stage_name_value := normalized ->> 'stage';

    -- Ensure the authoritative stage exists.
    insert into public.programme_stages (
      department_id,
      programme_id,
      stage_number,
      name,
      is_active,
      created_by,
      updated_at
    )
    values (
      selected_batch.department_id,
      programme_id_value,
      stage_number_value,
      stage_name_value,
      true,
      auth.uid(),
      now()
    )
    on conflict (programme_id, stage_number)
    do update set
      name = excluded.name,
      is_active = true,
      updated_at = now()
    returning id into stage_id_value;

    if nullif(normalized ->> 'unitId', '') is not null then
      unit_id_value := (normalized ->> 'unitId')::uuid;

      -- Curriculum is authoritative for official name and normal stage number.
      -- Preserve existing operational hours/category/timetable settings.
      update public.units
      set name = normalized ->> 'name',
          academic_period_number = stage_number_value,
          updated_by = auth.uid(),
          updated_at = now()
      where id = unit_id_value
        and programme_id = programme_id_value;

      if not found then
        raise exception using errcode = 'P0002',
          message = format('Matched unit no longer exists at source row %s', staged_row.source_row_number);
      end if;
    else
      insert into public.units (
        programme_id,
        code,
        name,
        category,
        academic_period_number,
        theory_hours,
        practical_hours,
        weekly_sessions,
        is_active,
        is_timetable_available,
        notes,
        created_by,
        updated_by
      )
      values (
        programme_id_value,
        normalized ->> 'code',
        normalized ->> 'name',
        'core',
        stage_number_value,
        2,
        0,
        1,
        true,
        true,
        'Created from authoritative curriculum import. Review contact hours and scheduling settings before first offering.',
        auth.uid(),
        auth.uid()
      )
      returning id into unit_id_value;
    end if;

    -- One authoritative current curriculum stage per unit.
    delete from public.programme_stage_units psu
    using public.programme_stages ps
    where psu.stage_id = ps.id
      and psu.unit_id = unit_id_value
      and ps.programme_id = programme_id_value
      and psu.stage_id <> stage_id_value;

    insert into public.programme_stage_units (
      stage_id,
      unit_id,
      created_by
    )
    values (
      stage_id_value,
      unit_id_value,
      auth.uid()
    )
    on conflict (stage_id, unit_id) do nothing;

    update public.import_rows
    set status = 'imported',
        imported_record_id = unit_id_value,
        imported_at = now(),
        row_errors = '[]'::jsonb
    where id = staged_row.id;

    imported_total := imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(target_batch_id);

  update public.import_batches
  set status = 'completed',
      failure_message = null,
      completed_at = now(),
      updated_at = now(),
      validation_summary =
        coalesce(validation_summary, '{}'::jsonb) ||
        jsonb_build_object(
          'confirmed_at', now(),
          'confirmed_by', auth.uid(),
          'workflow', 'authoritative_curriculum'
        )
  where id = target_batch_id;

  return query
  select target_batch_id, imported_total, skipped_total, failed_total;
end;
$$;

revoke all on function public.import_valid_curriculum_rows(uuid) from public, anon;
grant execute on function public.import_valid_curriculum_rows(uuid) to authenticated;

comment on function public.import_valid_curriculum_rows(uuid) is
  'Atomically imports a validated fixed-header Excel curriculum, matching legacy units by programme+code and binding units to programme stages.';
