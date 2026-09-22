-- ============================================================
-- v12.8.7 — Unit Import Duplicate Reconciliation
-- Mirrors the database uniqueness rules BEFORE unit insertion.
-- ============================================================

create or replace function public.reconcile_unit_import_duplicates(
  target_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  reclassified_total integer := 0;
  workbook_name_duplicates integer := 0;
  database_duplicates integer := 0;
begin
  select *
  into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Units import batch not found';
  end if;

  if selected_batch.entity_type::text <> 'units' then
    raise exception using
      errcode = 'P0001',
      message = 'Selected batch is not a Units import';
  end if;

  if selected_batch.department_id is not null
     and not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted to reconcile this Units import';
  end if;

  -- ----------------------------------------------------------
  -- 1. Workbook-level Unit Name duplicates.
  --
  -- Existing shared duplicate detection already covers the
  -- workbook duplicate key used by the app (programme + code).
  -- The database additionally requires programme + name to be
  -- unique. Catch repeated names with different codes here.
  -- ----------------------------------------------------------
  with ranked as (
    select
      ir.id,
      row_number() over (
        partition by
          ir.normalized_data ->> 'programmeId',
          lower(trim(ir.normalized_data ->> 'name'))
        order by ir.source_row_number, ir.id
      ) as rn
    from public.import_rows ir
    where ir.import_batch_id = target_batch_id
      and ir.status = 'valid'
      and nullif(ir.normalized_data ->> 'programmeId', '') is not null
      and nullif(trim(ir.normalized_data ->> 'name'), '') is not null
  )
  update public.import_rows ir
  set
    status = 'duplicate',
    row_errors =
      coalesce(ir.row_errors, '[]'::jsonb) ||
      jsonb_build_array(
        'Duplicate Unit Name in this workbook for the same programme. Unit names must be unique within a programme.'
      ),
    duplicate_key =
      concat(
        'programme-name:',
        ir.normalized_data ->> 'programmeId',
        ':',
        lower(trim(ir.normalized_data ->> 'name'))
      )
  from ranked r
  where ir.id = r.id
    and r.rn > 1;

  get diagnostics workbook_name_duplicates = row_count;

  -- ----------------------------------------------------------
  -- 2. Database conflicts by EITHER unique key:
  --    programme + Unit Code
  --    programme + Unit Name
  --
  -- A row must never remain Ready if PostgreSQL would reject it.
  -- ----------------------------------------------------------
  with conflicts as (
    select distinct on (ir.id)
      ir.id as import_row_id,
      u.id as existing_unit_id,
      u.code as existing_code,
      u.name as existing_name,
      case
        when lower(trim(u.code)) =
             lower(trim(ir.normalized_data ->> 'code'))
         and lower(trim(u.name)) =
             lower(trim(ir.normalized_data ->> 'name'))
          then 'same_code_and_name'
        when lower(trim(u.code)) =
             lower(trim(ir.normalized_data ->> 'code'))
          then 'same_code'
        else 'same_name'
      end as conflict_type
    from public.import_rows ir
    join public.units u
      on u.programme_id =
           (ir.normalized_data ->> 'programmeId')::uuid
     and (
       lower(trim(u.code)) =
         lower(trim(ir.normalized_data ->> 'code'))
       or
       lower(trim(u.name)) =
         lower(trim(ir.normalized_data ->> 'name'))
     )
    where ir.import_batch_id = target_batch_id
      and ir.status = 'valid'
      and nullif(ir.normalized_data ->> 'programmeId', '') is not null
    order by
      ir.id,
      case
        when lower(trim(u.code)) =
             lower(trim(ir.normalized_data ->> 'code'))
          then 0
        else 1
      end,
      u.id
  )
  update public.import_rows ir
  set
    status = 'duplicate',
    imported_record_id = c.existing_unit_id,
    row_errors =
      coalesce(ir.row_errors, '[]'::jsonb) ||
      jsonb_build_array(
        case c.conflict_type
          when 'same_code_and_name' then
            format(
              'Existing unit matched: %s — %s. This row will be skipped to prevent duplication.',
              c.existing_code,
              c.existing_name
            )
          when 'same_code' then
            format(
              'Unit Code %s already belongs to "%s" in this programme. Review the workbook name before changing the existing unit.',
              c.existing_code,
              c.existing_name
            )
          else
            format(
              'Unit Name "%s" already exists in this programme under code %s. This row cannot be inserted under a second code.',
              c.existing_name,
              c.existing_code
            )
        end
      ),
    duplicate_key =
      case c.conflict_type
        when 'same_name' then
          concat(
            'programme-name:',
            ir.normalized_data ->> 'programmeId',
            ':',
            lower(trim(ir.normalized_data ->> 'name'))
          )
        else
          concat(
            'programme-code:',
            ir.normalized_data ->> 'programmeId',
            ':',
            lower(trim(ir.normalized_data ->> 'code'))
          )
      end
  from conflicts c
  where ir.id = c.import_row_id;

  get diagnostics database_duplicates = row_count;

  reclassified_total :=
    workbook_name_duplicates +
    database_duplicates;

  perform public.refresh_import_batch_counts(target_batch_id);

  update public.import_batches
  set
    validation_summary =
      coalesce(validation_summary, '{}'::jsonb) ||
      jsonb_build_object(
        'database_duplicate_reconciliation',
        jsonb_build_object(
          'checked_at', now(),
          'workbook_name_duplicates', workbook_name_duplicates,
          'database_duplicates', database_duplicates,
          'reclassified_count', reclassified_total
        )
      ),
    updated_at = now()
  where id = target_batch_id;

  return jsonb_build_object(
    'reclassified_count', reclassified_total,
    'workbook_name_duplicates', workbook_name_duplicates,
    'database_duplicates', database_duplicates
  );
end;
$$;

revoke all
on function public.reconcile_unit_import_duplicates(uuid)
from public, anon;

grant execute
on function public.reconcile_unit_import_duplicates(uuid)
to authenticated;


-- ============================================================
-- Safe confirmation wrapper.
--
-- It reconciles against the latest database state in the same
-- transaction. If new conflicts are discovered, it DOES NOT
-- insert anything. The user is returned to review the updated
-- duplicate classifications first.
-- ============================================================

create or replace function public.safe_import_valid_unit_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer,
  reclassified_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconciliation jsonb;
  reclassified integer := 0;
  result record;
begin
  reconciliation :=
    public.reconcile_unit_import_duplicates(target_batch_id);

  reclassified :=
    coalesce(
      (reconciliation ->> 'reclassified_count')::integer,
      0
    );

  if reclassified > 0 then
    return query
    select
      target_batch_id,
      0::integer,
      reclassified,
      0::integer,
      reclassified;
    return;
  end if;

  select *
  into result
  from public.import_valid_unit_rows(target_batch_id);

  return query
  select
    result.batch_id,
    result.imported_count,
    result.skipped_count,
    result.failed_count,
    0::integer;
end;
$$;

revoke all
on function public.safe_import_valid_unit_rows(uuid)
from public, anon;

grant execute
on function public.safe_import_valid_unit_rows(uuid)
to authenticated;

comment on function public.reconcile_unit_import_duplicates(uuid) is
  'Reclassifies Units import rows that conflict with programme+code or programme+name uniqueness, including workbook same-name collisions.';

comment on function public.safe_import_valid_unit_rows(uuid) is
  'Rechecks database uniqueness immediately before Units import and requires review when new conflicts are discovered.';
