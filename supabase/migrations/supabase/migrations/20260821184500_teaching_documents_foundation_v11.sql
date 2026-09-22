begin;

-- ============================================================================
-- Teaching Documents Foundation V11
--
-- Controlled institutional templates + allocation-scoped document records.
-- Official DOCX/XLSX template files are connected in the template-ingestion
-- stage; V11 establishes the data model, versioning and access boundary.
-- ============================================================================

create table if not exists public.teaching_document_templates (
  id uuid primary key default gen_random_uuid(),

  document_type text not null
    check (
      document_type in (
        'attendance_sheet',
        'course_outline',
        'scheme_of_work',
        'record_of_work'
      )
    ),

  name text not null
    check (
      length(trim(name)) > 0
    ),

  version_number integer not null
    check (
      version_number >= 1
    ),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'active',
        'retired'
      )
    ),

  storage_path text,
  original_filename text,
  mime_type text,

  sha256 text
    check (
      sha256 is null
      or sha256 ~ '^[0-9a-f]{64}$'
    ),

  notes text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  activated_at timestamptz,
  retired_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint teaching_document_templates_type_version_unique
    unique (
      document_type,
      version_number
    ),

  constraint teaching_document_templates_active_file_check
    check (
      status <> 'active'
      or (
        storage_path is not null
        and trim(storage_path) <> ''
        and original_filename is not null
        and trim(original_filename) <> ''
      )
    )
);

create unique index if not exists
  teaching_document_templates_one_active_per_type_idx
on public.teaching_document_templates (
  document_type
)
where status = 'active';

create index if not exists
  teaching_document_templates_status_idx
on public.teaching_document_templates (
  status,
  document_type,
  version_number desc
);

comment on table public.teaching_document_templates is
  'Versioned institutional templates used to generate controlled teaching documents.';

create table if not exists public.teaching_documents (
  id uuid primary key default gen_random_uuid(),

  allocation_id uuid not null
    references public.teaching_allocations(id)
    on delete restrict,

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  trainer_id uuid not null
    references public.trainers(id)
    on delete restrict,

  document_type text not null
    check (
      document_type in (
        'attendance_sheet',
        'course_outline',
        'scheme_of_work',
        'record_of_work'
      )
    ),

  template_id uuid not null
    references public.teaching_document_templates(id)
    on delete restrict,

  version_number integer not null
    check (
      version_number >= 1
    ),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'generated',
        'submitted',
        'approved',
        'archived'
      )
    ),

  storage_path text,
  original_filename text,
  mime_type text,

  sha256 text
    check (
      sha256 is null
      or sha256 ~ '^[0-9a-f]{64}$'
    ),

  generated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,

  approved_by uuid
    references public.profiles(id)
    on delete set null,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint teaching_documents_allocation_type_version_unique
    unique (
      allocation_id,
      document_type,
      version_number
    ),

  constraint teaching_documents_generated_file_check
    check (
      status = 'draft'
      or (
        storage_path is not null
        and trim(storage_path) <> ''
      )
    )
);

create index if not exists
  teaching_documents_allocation_idx
on public.teaching_documents (
  allocation_id,
  document_type,
  version_number desc
);

create index if not exists
  teaching_documents_period_unit_idx
on public.teaching_documents (
  academic_period_id,
  unit_id,
  cohort_id,
  trainer_id
);

create index if not exists
  teaching_documents_status_idx
on public.teaching_documents (
  status,
  updated_at desc
);

comment on table public.teaching_documents is
  'Versioned teaching-document records anchored to one Teaching Allocation snapshot.';

alter table public.teaching_document_templates
  enable row level security;

alter table public.teaching_documents
  enable row level security;

-- ----------------------------------------------------------------------------
-- Shared actor authorization.
-- ----------------------------------------------------------------------------

create or replace function public.teaching_document_actor_can_manage_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_allocation(
      target_allocation_id
    );
$$;

revoke all
on function public.teaching_document_actor_can_manage_allocation(uuid)
from public;

grant execute
on function public.teaching_document_actor_can_manage_allocation(uuid)
to authenticated;

comment on function public.teaching_document_actor_can_manage_allocation(uuid) is
  'True for HOD/system-admin or the trainer who owns the Teaching Allocation.';

-- ----------------------------------------------------------------------------
-- Template RLS.
-- ----------------------------------------------------------------------------

drop policy if exists teaching_document_templates_hod_all
on public.teaching_document_templates;

create policy teaching_document_templates_hod_all
on public.teaching_document_templates
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists teaching_document_templates_active_read
on public.teaching_document_templates;

create policy teaching_document_templates_active_read
on public.teaching_document_templates
for select
to authenticated
using (
  status = 'active'
  or public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

-- ----------------------------------------------------------------------------
-- Document RLS.
-- ----------------------------------------------------------------------------

drop policy if exists teaching_documents_hod_all
on public.teaching_documents;

create policy teaching_documents_hod_all
on public.teaching_documents
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists teaching_documents_trainer_read
on public.teaching_documents;

create policy teaching_documents_trainer_read
on public.teaching_documents
for select
to authenticated
using (
  public.trainer_can_access_allocation(
    allocation_id
  )
);

grant select
on public.teaching_document_templates,
   public.teaching_documents
to authenticated;

-- ----------------------------------------------------------------------------
-- Create one allocation-scoped draft record from the current active template.
--
-- The caller never supplies period/cohort/unit/trainer snapshot IDs. Those are
-- copied from the Teaching Allocation by the database.
-- ----------------------------------------------------------------------------

create or replace function public.create_teaching_document_record(
  target_allocation_id uuid,
  target_document_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allocation_row record;
  template_row record;
  existing_row record;
  next_version integer;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
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

  if not public.teaching_document_actor_can_manage_allocation(
    target_allocation_id
  ) then
    raise exception
      'This Teaching Allocation is outside your access.'
      using errcode = '42501';
  end if;

  select
    allocation.id,
    allocation.academic_period_id,
    allocation.cohort_id,
    allocation.unit_id,
    allocation.trainer_id,
    allocation.status::text as status
  into allocation_row
  from public.teaching_allocations
    as allocation
  where allocation.id =
    target_allocation_id;

  if not found then
    raise exception
      'Teaching Allocation was not found.'
      using errcode = 'P0002';
  end if;

  if allocation_row.status not in (
    'active',
    'completed'
  ) and not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Trainer document work requires an active or completed Teaching Allocation.'
      using errcode = '23514';
  end if;

  select
    template.id,
    template.version_number
  into template_row
  from public.teaching_document_templates
    as template
  where template.document_type =
      target_document_type
    and template.status =
      'active'
    and template.storage_path is not null
  order by
    template.version_number desc
  limit 1;

  if not found then
    raise exception
      'No active institutional template is available for this document.'
      using errcode = 'P0002';
  end if;

  select
    document.id,
    document.status,
    document.version_number
  into existing_row
  from public.teaching_documents
    as document
  where document.allocation_id =
      target_allocation_id
    and document.document_type =
      target_document_type
    and document.status <>
      'archived'
  order by
    document.version_number desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id',
      existing_row.id,
      'status',
      existing_row.status,
      'versionNumber',
      existing_row.version_number,
      'alreadyExists',
      true
    );
  end if;

  select
    coalesce(
      max(document.version_number),
      0
    ) + 1
  into next_version
  from public.teaching_documents
    as document
  where document.allocation_id =
      target_allocation_id
    and document.document_type =
      target_document_type;

  insert into public.teaching_documents (
    allocation_id,
    academic_period_id,
    cohort_id,
    unit_id,
    trainer_id,
    document_type,
    template_id,
    version_number,
    status,
    created_by,
    updated_by
  )
  values (
    allocation_row.id,
    allocation_row.academic_period_id,
    allocation_row.cohort_id,
    allocation_row.unit_id,
    allocation_row.trainer_id,
    target_document_type,
    template_row.id,
    next_version,
    'draft',
    auth.uid(),
    auth.uid()
  )
  returning id
  into new_id;

  return jsonb_build_object(
    'id',
    new_id,
    'status',
    'draft',
    'versionNumber',
    next_version,
    'templateVersion',
    template_row.version_number,
    'alreadyExists',
    false
  );
end;
$$;

revoke all
on function public.create_teaching_document_record(uuid, text)
from public;

grant execute
on function public.create_teaching_document_record(uuid, text)
to authenticated;

comment on function public.create_teaching_document_record(uuid, text) is
  'Creates or returns the current allocation-scoped teaching-document draft using the active institutional template.';

commit;
