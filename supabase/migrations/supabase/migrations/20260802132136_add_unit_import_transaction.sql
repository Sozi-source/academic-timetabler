-- ============================================================
-- HND App: Transactional Unit Bulk Import
-- ============================================================

create or replace function
  public.import_valid_unit_rows(
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
  created_unit_id uuid;

  imported_total integer := 0;
  skipped_total integer := 0;
  failed_total integer := 0;
begin
  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message =
        'You are not authorized to import units';
  end if;

  select *
  into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using
      errcode = 'P0002',
      message =
        'The requested import batch was not found';
  end if;

  if selected_batch.entity_type <> 'units' then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected import batch is not a Units import';
  end if;

  if selected_batch.status <> 'validated' then
    raise exception using
      errcode = 'P0001',
      message =
        'Only validated Units import batches can be confirmed';
  end if;

  update public.import_batches
  set
    status = 'importing',
    failure_message = null
  where id = target_batch_id;

  update public.import_rows
  set status = 'skipped'
  where import_batch_id = target_batch_id
    and status in (
      'invalid',
      'duplicate'
    );

  get diagnostics skipped_total = row_count;

  for staged_row in
    select *
    from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized :=
      staged_row.normalized_data;

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
      (
        normalized ->> 'programmeId'
      )::uuid,
      normalized ->> 'code',
      normalized ->> 'name',
      nullif(
        normalized ->> 'shortName',
        ''
      ),
      (
        normalized ->> 'category'
      )::public.unit_category,
      (
        normalized ->> 'academicPeriodNumber'
      )::smallint,
      (
        normalized ->> 'theoryHours'
      )::numeric,
      (
        normalized ->> 'practicalHours'
      )::numeric,
      (
        normalized ->> 'weeklySessions'
      )::smallint,
      case
        when nullif(
          normalized ->> 'preferredRoomType',
          ''
        ) is null
          then null
        else (
          normalized ->> 'preferredRoomType'
        )::public.room_type
      end,
      true,
      coalesce(
        (
          normalized ->> 'timetableAvailable'
        )::boolean,
        true
      ),
      nullif(
        normalized ->> 'notes',
        ''
      ),
      auth.uid(),
      auth.uid()
    )
    returning id
    into created_unit_id;

    update public.import_rows
    set
      status = 'imported',
      imported_record_id =
        created_unit_id,
      imported_at = now(),
      row_errors = '[]'::jsonb
    where id = staged_row.id;

    imported_total :=
      imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(
    target_batch_id
  );

  update public.import_batches
  set
    status = case
      when skipped_total > 0
        then 'completed_with_errors'
      else 'completed'
    end,
    failure_message = null,
    completed_at = now(),
    validation_summary =
      coalesce(
        validation_summary,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'confirmed_at',
        now(),
        'confirmed_by',
        auth.uid()
      )
  where id = target_batch_id;

  return query
  select
    target_batch_id,
    imported_total,
    skipped_total,
    failed_total;
end;
$$;

revoke all
on function
  public.import_valid_unit_rows(uuid)
from public;

grant execute
on function
  public.import_valid_unit_rows(uuid)
to authenticated;

comment on function
  public.import_valid_unit_rows(uuid)
is
  'Atomically imports valid staged Unit rows and completes the import audit batch.';