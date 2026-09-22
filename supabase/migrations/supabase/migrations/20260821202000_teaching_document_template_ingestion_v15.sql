begin;

-- ============================================================================
-- Teaching Document Template Ingestion V15
--
-- Stores only official institutional template files in a private Supabase
-- Storage bucket. Uploads and downloads are mediated by authenticated server
-- routes; no direct authenticated Storage policies are created.
-- ============================================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'teaching-documents-private',
  'teaching-documents-private',
  false,
  15728640,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ]::text[]
)
on conflict (id)
do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.teaching_document_templates
  add column if not exists storage_bucket text
    not null
    default 'teaching-documents-private';

alter table public.teaching_document_templates
  add column if not exists file_size_bytes bigint;

alter table public.teaching_document_templates
  add column if not exists uploaded_at timestamptz;

alter table public.teaching_documents
  add column if not exists storage_bucket text
    not null
    default 'teaching-documents-private';

alter table public.teaching_documents
  add column if not exists file_size_bytes bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'teaching_document_templates_file_size_check'
  ) then
    alter table public.teaching_document_templates
      add constraint teaching_document_templates_file_size_check
      check (
        file_size_bytes is null
        or (
          file_size_bytes > 0
          and file_size_bytes <= 15728640
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'teaching_documents_file_size_check'
  ) then
    alter table public.teaching_documents
      add constraint teaching_documents_file_size_check
      check (
        file_size_bytes is null
        or (
          file_size_bytes > 0
          and file_size_bytes <= 15728640
        )
      );
  end if;
end;
$$;

create unique index if not exists
  teaching_document_templates_type_sha256_unique_idx
on public.teaching_document_templates (
  document_type,
  sha256
)
where sha256 is not null;

-- ----------------------------------------------------------------------------
-- Register a newly uploaded official template as the next DRAFT version.
-- The file is uploaded to private Storage first; this function owns metadata,
-- version sequencing and authorization.
-- ----------------------------------------------------------------------------

create or replace function public.create_teaching_document_template_version(
  target_document_type text,
  target_name text,
  target_storage_bucket text,
  target_storage_path text,
  target_original_filename text,
  target_mime_type text,
  target_file_size_bytes bigint,
  target_sha256 text,
  target_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_version integer;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may upload institutional templates.'
      using errcode = '42501';
  end if;

  if target_document_type not in (
    'attendance_sheet',
    'course_outline',
    'scheme_of_work',
    'record_of_work'
  ) then
    raise exception
      'Unsupported teaching document type.'
      using errcode = '23514';
  end if;

  if target_name is null
     or trim(target_name) = ''
  then
    raise exception
      'Template name is required.'
      using errcode = '23514';
  end if;

  if target_storage_bucket <> 'teaching-documents-private' then
    raise exception
      'Unsupported storage bucket.'
      using errcode = '23514';
  end if;

  if target_storage_path is null
     or trim(target_storage_path) = ''
     or target_storage_path not like
       (
         'templates/' ||
         target_document_type ||
         '/%'
       )
  then
    raise exception
      'Template storage path is invalid.'
      using errcode = '23514';
  end if;

  if target_original_filename is null
     or trim(target_original_filename) = ''
  then
    raise exception
      'Original filename is required.'
      using errcode = '23514';
  end if;

  if target_mime_type not in (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ) then
    raise exception
      'Unsupported institutional template file type.'
      using errcode = '23514';
  end if;

  if target_file_size_bytes is null
     or target_file_size_bytes <= 0
     or target_file_size_bytes > 15728640
  then
    raise exception
      'Template file size is invalid.'
      using errcode = '23514';
  end if;

  if target_sha256 is null
     or target_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception
      'Template SHA-256 is invalid.'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      'teaching-document-template'
    ),
    hashtext(
      target_document_type
    )
  );

  if exists (
    select 1
    from public.teaching_document_templates
      as template
    where template.document_type =
        target_document_type
      and template.sha256 =
        target_sha256
  ) then
    raise exception
      'This exact template file is already registered for this document type.'
      using errcode = '23505';
  end if;

  select
    coalesce(
      max(template.version_number),
      0
    ) + 1
  into next_version
  from public.teaching_document_templates
    as template
  where template.document_type =
    target_document_type;

  insert into public.teaching_document_templates (
    document_type,
    name,
    version_number,
    status,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    file_size_bytes,
    sha256,
    notes,
    created_by,
    updated_by,
    uploaded_at
  )
  values (
    target_document_type,
    trim(target_name),
    next_version,
    'draft',
    target_storage_bucket,
    target_storage_path,
    trim(target_original_filename),
    target_mime_type,
    target_file_size_bytes,
    target_sha256,
    nullif(
      trim(
        coalesce(
          target_notes,
          ''
        )
      ),
      ''
    ),
    auth.uid(),
    auth.uid(),
    now()
  )
  returning id
  into new_id;

  return jsonb_build_object(
    'id',
    new_id,
    'versionNumber',
    next_version,
    'status',
    'draft'
  );
end;
$$;

revoke all
on function public.create_teaching_document_template_version(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text
)
from public;

grant execute
on function public.create_teaching_document_template_version(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Activate one exact version. The previous active version is retired first,
-- preserving one active institutional template per document type.
-- ----------------------------------------------------------------------------

create or replace function public.activate_teaching_document_template(
  target_template_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template_row record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may activate institutional templates.'
      using errcode = '42501';
  end if;

  select
    template.id,
    template.document_type,
    template.version_number,
    template.status,
    template.storage_path,
    template.sha256
  into template_row
  from public.teaching_document_templates
    as template
  where template.id =
    target_template_id
  for update;

  if not found then
    raise exception
      'Template version was not found.'
      using errcode = 'P0002';
  end if;

  if template_row.storage_path is null
     or trim(template_row.storage_path) = ''
     or template_row.sha256 is null
  then
    raise exception
      'Template version has no verified stored file.'
      using errcode = '23514';
  end if;

  if template_row.status = 'active' then
    return jsonb_build_object(
      'id',
      template_row.id,
      'versionNumber',
      template_row.version_number,
      'status',
      'active',
      'alreadyActive',
      true
    );
  end if;

  update public.teaching_document_templates
  set
    status = 'retired',
    retired_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  where document_type =
      template_row.document_type
    and status = 'active'
    and id <>
      template_row.id;

  update public.teaching_document_templates
  set
    status = 'active',
    activated_at = now(),
    retired_at = null,
    updated_at = now(),
    updated_by = auth.uid()
  where id =
    template_row.id;

  return jsonb_build_object(
    'id',
    template_row.id,
    'versionNumber',
    template_row.version_number,
    'status',
    'active',
    'alreadyActive',
    false
  );
end;
$$;

revoke all
on function public.activate_teaching_document_template(uuid)
from public;

grant execute
on function public.activate_teaching_document_template(uuid)
to authenticated;

create or replace function public.retire_teaching_document_template(
  target_template_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template_row record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may retire institutional templates.'
      using errcode = '42501';
  end if;

  select
    template.id,
    template.version_number,
    template.status
  into template_row
  from public.teaching_document_templates
    as template
  where template.id =
    target_template_id
  for update;

  if not found then
    raise exception
      'Template version was not found.'
      using errcode = 'P0002';
  end if;

  if template_row.status <> 'retired' then
    update public.teaching_document_templates
    set
      status = 'retired',
      retired_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
    where id =
      template_row.id;
  end if;

  return jsonb_build_object(
    'id',
    template_row.id,
    'versionNumber',
    template_row.version_number,
    'status',
    'retired'
  );
end;
$$;

revoke all
on function public.retire_teaching_document_template(uuid)
from public;

grant execute
on function public.retire_teaching_document_template(uuid)
to authenticated;

comment on function public.create_teaching_document_template_version(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text
) is
  'Registers the next immutable institutional template version after a private Storage upload.';

comment on function public.activate_teaching_document_template(uuid) is
  'Activates one exact institutional template version and retires any currently active version of the same document type.';

comment on function public.retire_teaching_document_template(uuid) is
  'Retires an institutional template version without deleting its audit history or stored file.';

commit;
