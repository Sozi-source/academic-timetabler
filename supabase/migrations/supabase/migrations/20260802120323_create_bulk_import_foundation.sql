-- ============================================================
-- HND App: Bulk Import Foundation
-- ============================================================

do $$
begin
  create type public.import_entity_type as enum (
    'trainers',
    'rooms',
    'programmes',
    'cohorts',
    'units',
    'teaching_allocations'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.import_batch_status as enum (
    'uploaded',
    'validating',
    'validated',
    'importing',
    'completed',
    'completed_with_errors',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.import_row_status as enum (
    'pending',
    'valid',
    'invalid',
    'duplicate',
    'imported',
    'skipped',
    'failed'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),

  entity_type public.import_entity_type
    not null,

  template_version text
    not null,

  original_file_name text
    not null,

  file_size_bytes bigint,

  storage_bucket text,

  storage_path text,

  status public.import_batch_status
    not null
    default 'uploaded',

  total_rows integer
    not null
    default 0,

  valid_rows integer
    not null
    default 0,

  invalid_rows integer
    not null
    default 0,

  duplicate_rows integer
    not null
    default 0,

  imported_rows integer
    not null
    default 0,

  skipped_rows integer
    not null
    default 0,

  failed_rows integer
    not null
    default 0,

  validation_summary jsonb
    not null
    default '{}'::jsonb,

  import_options jsonb
    not null
    default '{}'::jsonb,

  failure_message text,

  started_at timestamptz,

  completed_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint import_batches_template_version_check
    check (
      char_length(trim(template_version))
      between 1 and 30
    ),

  constraint import_batches_file_name_check
    check (
      char_length(trim(original_file_name))
      between 1 and 255
    ),

  constraint import_batches_file_size_check
    check (
      file_size_bytes is null
      or file_size_bytes between 1 and 52428800
    ),

  constraint import_batches_row_counts_check
    check (
      total_rows >= 0
      and valid_rows >= 0
      and invalid_rows >= 0
      and duplicate_rows >= 0
      and imported_rows >= 0
      and skipped_rows >= 0
      and failed_rows >= 0
    ),

  constraint import_batches_failure_message_check
    check (
      failure_message is null
      or char_length(failure_message) <= 3000
    )
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),

  import_batch_id uuid
    not null
    references public.import_batches(id)
    on delete cascade,

  source_row_number integer
    not null,

  status public.import_row_status
    not null
    default 'pending',

  source_data jsonb
    not null
    default '{}'::jsonb,

  normalized_data jsonb
    not null
    default '{}'::jsonb,

  field_errors jsonb
    not null
    default '{}'::jsonb,

  row_errors jsonb
    not null
    default '[]'::jsonb,

  duplicate_key text,

  imported_record_id uuid,

  imported_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint import_rows_source_row_check
    check (
      source_row_number >= 2
    ),

  constraint import_rows_duplicate_key_check
    check (
      duplicate_key is null
      or char_length(duplicate_key) <= 500
    ),

  constraint import_rows_unique_source_row
    unique (
      import_batch_id,
      source_row_number
    )
);

create index import_batches_entity_type_idx
  on public.import_batches (
    entity_type,
    created_at desc
  );

create index import_batches_status_idx
  on public.import_batches (
    status,
    created_at desc
  );

create index import_batches_created_by_idx
  on public.import_batches (
    created_by,
    created_at desc
  );

create index import_rows_batch_status_idx
  on public.import_rows (
    import_batch_id,
    status
  );

create index import_rows_imported_record_idx
  on public.import_rows (
    imported_record_id
  )
  where imported_record_id is not null;

create index import_rows_duplicate_key_idx
  on public.import_rows (
    import_batch_id,
    duplicate_key
  )
  where duplicate_key is not null;

-- ------------------------------------------------------------
-- Audit and lifecycle normalization
-- ------------------------------------------------------------

create or replace function
  public.set_import_batch_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.template_version =
    trim(new.template_version);

  new.original_file_name =
    trim(new.original_file_name);

  new.storage_bucket =
    nullif(trim(new.storage_bucket), '');

  new.storage_path =
    nullif(trim(new.storage_path), '');

  new.failure_message =
    nullif(trim(new.failure_message), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  if new.status = 'validating'
     and new.started_at is null then
    new.started_at = now();
  end if;

  if new.status in (
    'completed',
    'completed_with_errors',
    'failed',
    'cancelled'
  )
  and new.completed_at is null then
    new.completed_at = now();
  end if;

  return new;
end;
$$;

create trigger import_batches_set_audit_fields
before insert or update
on public.import_batches
for each row
execute function
  public.set_import_batch_audit_fields();

create or replace function
  public.set_import_row_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.duplicate_key =
    nullif(trim(new.duplicate_key), '');

  new.updated_at = now();

  if new.status = 'imported'
     and new.imported_at is null then
    new.imported_at = now();
  end if;

  return new;
end;
$$;

create trigger import_rows_set_audit_fields
before insert or update
on public.import_rows
for each row
execute function
  public.set_import_row_audit_fields();

-- ------------------------------------------------------------
-- Batch counter recalculation
-- ------------------------------------------------------------

create or replace function
  public.refresh_import_batch_counts(
    target_batch_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.import_batches
  set
    total_rows = counts.total_rows,
    valid_rows = counts.valid_rows,
    invalid_rows = counts.invalid_rows,
    duplicate_rows = counts.duplicate_rows,
    imported_rows = counts.imported_rows,
    skipped_rows = counts.skipped_rows,
    failed_rows = counts.failed_rows
  from (
    select
      count(*)::integer as total_rows,

      count(*) filter (
        where status = 'valid'
      )::integer as valid_rows,

      count(*) filter (
        where status = 'invalid'
      )::integer as invalid_rows,

      count(*) filter (
        where status = 'duplicate'
      )::integer as duplicate_rows,

      count(*) filter (
        where status = 'imported'
      )::integer as imported_rows,

      count(*) filter (
        where status = 'skipped'
      )::integer as skipped_rows,

      count(*) filter (
        where status = 'failed'
      )::integer as failed_rows
    from public.import_rows
    where import_batch_id = target_batch_id
  ) as counts
  where id = target_batch_id;
end;
$$;

revoke all
on function
  public.refresh_import_batch_counts(uuid)
from public;

grant execute
on function
  public.refresh_import_batch_counts(uuid)
to authenticated;

create or replace function
  public.refresh_import_batch_counts_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_import_batch_counts(
    coalesce(
      new.import_batch_id,
      old.import_batch_id
    )
  );

  return coalesce(new, old);
end;
$$;

create trigger import_rows_refresh_batch_counts
after insert or update or delete
on public.import_rows
for each row
execute function
  public.refresh_import_batch_counts_trigger();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.import_batches
enable row level security;

alter table public.import_rows
enable row level security;

revoke all
on table public.import_batches
from anon;

revoke all
on table public.import_rows
from anon;

revoke all
on table public.import_batches
from authenticated;

revoke all
on table public.import_rows
from authenticated;

grant select, insert, update
on table public.import_batches
to authenticated;

grant select, insert, update, delete
on table public.import_rows
to authenticated;

create policy
  "Authorized staff can view import batches"
on public.import_batches
for select
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can create import batches"
on public.import_batches
for insert
to authenticated
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
  and created_by = (select auth.uid())
);

create policy
  "Authorized staff can update import batches"
on public.import_batches
for update
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
)
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can view import rows"
on public.import_rows
for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id =
      import_rows.import_batch_id
      and (
        select public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
      )
  )
);

create policy
  "Authorized staff can create import rows"
on public.import_rows
for insert
to authenticated
with check (
  exists (
    select 1
    from public.import_batches
    where import_batches.id =
      import_rows.import_batch_id
      and (
        select public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
      )
  )
);

create policy
  "Authorized staff can update import rows"
on public.import_rows
for update
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id =
      import_rows.import_batch_id
      and (
        select public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.import_batches
    where import_batches.id =
      import_rows.import_batch_id
      and (
        select public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
      )
  )
);

create policy
  "Authorized staff can delete staged import rows"
on public.import_rows
for delete
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id =
      import_rows.import_batch_id
      and import_batches.status in (
        'uploaded',
        'validating',
        'validated',
        'cancelled',
        'failed'
      )
      and (
        select public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
      )
  )
);

comment on table public.import_batches is
  'Audit record for each standardized spreadsheet upload and import operation.';

comment on table public.import_rows is
  'Staged and validated spreadsheet rows belonging to an import batch.';

comment on column public.import_batches.template_version is
  'Template version used to validate spreadsheet compatibility.';

comment on column public.import_rows.source_data is
  'Original row values extracted from the uploaded workbook.';

comment on column public.import_rows.normalized_data is
  'Validated and normalized values ready for database insertion.';

comment on column public.import_rows.field_errors is
  'Validation errors indexed by spreadsheet field or column.';

comment on column public.import_rows.row_errors is
  'General row-level validation or relationship errors.';