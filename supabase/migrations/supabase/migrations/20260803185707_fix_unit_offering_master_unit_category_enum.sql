-- ============================================================
-- Fix Units on Offer automatic Master Unit category enum
-- Replaces prepare_and_import_valid_unit_offering_rows()
-- ============================================================
create or replace function public.prepare_and_import_valid_unit_offering_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  updated_count integer,
  skipped_count integer,
  failed_count integer,
  shared_offering_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  staged_row record;
  normalized jsonb;
  resolved_unit_id uuid;
  resolved_programme_id uuid;
  supplied_code text;
  supplied_name text;
  master_operation text;
  period_number integer;
  unit_category public.unit_category;
  theory_hours numeric;
  practical_hours numeric;
  unit_weekly_sessions integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'unit-offering-import:' ||
      target_batch_id::text,
      0
    )
  );

  if not exists (
    select 1
    from public.import_batches batch
    where batch.id = target_batch_id
      and batch.entity_type = 'unit_offerings'
      and batch.status = 'validated'
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'The validated Units on Offer import batch was not found.';
  end if;

  for staged_row in
    select row_record.id,
           row_record.normalized_data
    from public.import_rows row_record
    where row_record.import_batch_id = target_batch_id
      and row_record.status = 'valid'
    order by row_record.source_row_number
    for update
  loop
    normalized := staged_row.normalized_data;

    resolved_programme_id :=
      nullif(normalized ->> 'programmeId', '')::uuid;

    resolved_unit_id :=
      nullif(normalized ->> 'unitId', '')::uuid;

    supplied_code :=
      upper(trim(normalized ->> 'unitCode'));

    supplied_name :=
      trim(normalized ->> 'unitName');

    master_operation :=
      coalesce(
        normalized ->> 'masterUnitOperation',
        'existing'
      );

    if resolved_programme_id is null then
      raise exception using
        errcode = '23502',
        message = 'A staged row is missing its programme identifier.';
    end if;

    if resolved_unit_id is null then
      if supplied_code is null or supplied_code = '' then
        raise exception using
          errcode = '23502',
          message = 'A unit code is required to create a missing Master Unit.';
      end if;

      select unit_record.id
      into resolved_unit_id
      from public.units unit_record
      where unit_record.programme_id = resolved_programme_id
        and upper(trim(unit_record.code)) = supplied_code
      limit 1
      for update;

      if resolved_unit_id is null then
        period_number :=
          greatest(
            1,
            coalesce(
              (normalized ->> 'masterUnitAcademicPeriodNumber')::integer,
              1
            )
          );

        unit_category :=
          coalesce(
            nullif(
              normalized ->> 'masterUnitCategory',
              ''
            ),
            'core'
          )::public.unit_category;

        theory_hours :=
          greatest(
            0,
            coalesce(
              (normalized ->> 'masterUnitTheoryHours')::numeric,
              0
            )
          );

        practical_hours :=
          greatest(
            0,
            coalesce(
              (normalized ->> 'masterUnitPracticalHours')::numeric,
              0
            )
          );

        unit_weekly_sessions :=
          greatest(
            1,
            coalesce(
              (normalized ->> 'masterUnitWeeklySessions')::integer,
              1
            )
          );

        insert into public.units (
          programme_id,
          code,
          name,
          short_name,
          category,
          academic_period_number,
          theory_hours,
          practical_hours,
          weekly_sessions,
          preferred_room_type,
          is_active,
          is_timetable_available,
          notes,
          created_by,
          updated_by
        )
        values (
          resolved_programme_id,
          supplied_code,
          supplied_name,
          null,
          unit_category,
          period_number,
          theory_hours,
          practical_hours,
          unit_weekly_sessions,
          null,
          true,
          true,
          'Created automatically from Units on Offer import.',
          auth.uid(),
          auth.uid()
        )
        returning id into resolved_unit_id;

        master_operation := 'create';
      else
        update public.units
        set is_active = true,
            is_timetable_available = true,
            updated_by = auth.uid(),
            updated_at = now()
        where id = resolved_unit_id
          and (
            is_active = false or
            is_timetable_available = false
          );

        if found then
          master_operation := 'reactivate';
        else
          master_operation := 'existing';
        end if;
      end if;

      normalized :=
        jsonb_set(
          normalized,
          '{unitId}',
          to_jsonb(resolved_unit_id::text),
          true
        );

      normalized :=
        jsonb_set(
          normalized,
          '{masterUnitOperation}',
          to_jsonb(master_operation),
          true
        );

      update public.import_rows
      set normalized_data = normalized
      where id = staged_row.id;
    elsif master_operation = 'reactivate' then
      update public.units
      set is_active = true,
          is_timetable_available = true,
          updated_by = auth.uid(),
          updated_at = now()
      where id = resolved_unit_id;
    end if;
  end loop;

  return query
  select result.batch_id,
         result.imported_count,
         result.updated_count,
         result.skipped_count,
         result.failed_count,
         result.shared_offering_count
  from public.import_valid_unit_offering_rows(
    target_batch_id
  ) result;
end;
$$;

revoke all
on function public.prepare_and_import_valid_unit_offering_rows(uuid)
from public;

grant execute
on function public.prepare_and_import_valid_unit_offering_rows(uuid)
to authenticated;

comment on function public.prepare_and_import_valid_unit_offering_rows(uuid) is
  'Atomically resolves or creates missing Master Units before delegating to the existing Units on Offer import transaction.';
