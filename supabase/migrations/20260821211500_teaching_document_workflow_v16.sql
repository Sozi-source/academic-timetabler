begin;

-- ============================================================================
-- Teaching Document Working Copies + Review V16
--
-- Turns V11/V15 controlled template records into an operational workflow:
--
-- Active official template
--   -> exact private working copy
--   -> trainer revisions
--   -> submission
--   -> HOD review
--   -> approved OR returned for correction
--
-- Every uploaded working-file revision is immutable and separately auditable.
-- ============================================================================

alter table public.teaching_documents
  drop constraint if exists teaching_documents_status_check;

alter table public.teaching_documents
  add constraint teaching_documents_status_check
  check (
    status in (
      'draft',
      'generated',
      'submitted',
      'returned',
      'approved',
      'archived'
    )
  );

alter table public.teaching_documents
  add column if not exists current_revision_number integer;

alter table public.teaching_documents
  add column if not exists submitted_revision_number integer;

alter table public.teaching_documents
  add column if not exists approved_revision_number integer;

alter table public.teaching_documents
  add column if not exists review_note text;

alter table public.teaching_documents
  add column if not exists returned_at timestamptz;

alter table public.teaching_documents
  add column if not exists returned_by uuid
    references public.profiles(id)
    on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'teaching_documents_current_revision_check'
  ) then
    alter table public.teaching_documents
      add constraint teaching_documents_current_revision_check
      check (
        current_revision_number is null
        or current_revision_number >= 1
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'teaching_documents_submitted_revision_check'
  ) then
    alter table public.teaching_documents
      add constraint teaching_documents_submitted_revision_check
      check (
        submitted_revision_number is null
        or submitted_revision_number >= 1
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'teaching_documents_approved_revision_check'
  ) then
    alter table public.teaching_documents
      add constraint teaching_documents_approved_revision_check
      check (
        approved_revision_number is null
        or approved_revision_number >= 1
      );
  end if;
end;
$$;

create table if not exists public.teaching_document_revisions (
  id uuid primary key
    default gen_random_uuid(),

  document_id uuid not null
    references public.teaching_documents(id)
    on delete restrict,

  revision_number integer not null
    check (
      revision_number >= 1
    ),

  source text not null
    check (
      source in (
        'template_copy',
        'trainer_upload'
      )
    ),

  storage_bucket text not null
    default 'teaching-documents-private',

  storage_path text not null
    check (
      length(
        trim(
          storage_path
        )
      ) > 0
    ),

  original_filename text not null
    check (
      length(
        trim(
          original_filename
        )
      ) > 0
    ),

  mime_type text not null,

  file_size_bytes bigint not null
    check (
      file_size_bytes > 0
      and file_size_bytes <= 15728640
    ),

  sha256 text not null
    check (
      sha256 ~ '^[0-9a-f]{64}$'
    ),

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint teaching_document_revisions_document_revision_unique
    unique (
      document_id,
      revision_number
    ),

  constraint teaching_document_revisions_storage_unique
    unique (
      storage_bucket,
      storage_path
    )
);

create index if not exists
  teaching_document_revisions_document_idx
on public.teaching_document_revisions (
  document_id,
  revision_number desc
);

create table if not exists public.teaching_document_submissions (
  id uuid primary key
    default gen_random_uuid(),

  document_id uuid not null
    references public.teaching_documents(id)
    on delete restrict,

  revision_number integer not null
    check (
      revision_number >= 1
    ),

  submitted_by uuid
    references public.profiles(id)
    on delete set null,

  submitted_at timestamptz not null
    default now()
);

create index if not exists
  teaching_document_submissions_document_idx
on public.teaching_document_submissions (
  document_id,
  submitted_at desc
);

create table if not exists public.teaching_document_reviews (
  id uuid primary key
    default gen_random_uuid(),

  document_id uuid not null
    references public.teaching_documents(id)
    on delete restrict,

  revision_number integer not null
    check (
      revision_number >= 1
    ),

  decision text not null
    check (
      decision in (
        'approved',
        'returned'
      )
    ),

  note text,

  reviewed_by uuid
    references public.profiles(id)
    on delete set null,

  reviewed_at timestamptz not null
    default now(),

  constraint teaching_document_reviews_return_note_check
    check (
      decision <> 'returned'
      or (
        note is not null
        and length(
          trim(
            note
          )
        ) > 0
      )
    )
);

create index if not exists
  teaching_document_reviews_document_idx
on public.teaching_document_reviews (
  document_id,
  reviewed_at desc
);

alter table public.teaching_document_revisions
  enable row level security;

alter table public.teaching_document_submissions
  enable row level security;

alter table public.teaching_document_reviews
  enable row level security;

drop policy if exists teaching_document_revisions_hod_read
on public.teaching_document_revisions;

create policy teaching_document_revisions_hod_read
on public.teaching_document_revisions
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists teaching_document_revisions_trainer_read
on public.teaching_document_revisions;

create policy teaching_document_revisions_trainer_read
on public.teaching_document_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_revisions.document_id
      and public.trainer_can_access_allocation(
        document.allocation_id
      )
  )
);

drop policy if exists teaching_document_submissions_hod_read
on public.teaching_document_submissions;

create policy teaching_document_submissions_hod_read
on public.teaching_document_submissions
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists teaching_document_submissions_trainer_read
on public.teaching_document_submissions;

create policy teaching_document_submissions_trainer_read
on public.teaching_document_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_submissions.document_id
      and public.trainer_can_access_allocation(
        document.allocation_id
      )
  )
);

drop policy if exists teaching_document_reviews_hod_read
on public.teaching_document_reviews;

create policy teaching_document_reviews_hod_read
on public.teaching_document_reviews
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists teaching_document_reviews_trainer_read
on public.teaching_document_reviews;

create policy teaching_document_reviews_trainer_read
on public.teaching_document_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_documents
      as document
    where document.id =
        teaching_document_reviews.document_id
      and public.trainer_can_access_allocation(
        document.allocation_id
      )
  )
);

grant select
on public.teaching_document_revisions,
   public.teaching_document_submissions,
   public.teaching_document_reviews
to authenticated;

-- ----------------------------------------------------------------------------
-- Register a private working-file revision.
--
-- Storage itself remains service-role only. This function records metadata
-- after the server has stored the file. The path is constrained to the
-- document's own private folder.
-- ----------------------------------------------------------------------------

create or replace function public.record_teaching_document_revision(
  target_document_id uuid,
  target_source text,
  target_storage_bucket text,
  target_storage_path text,
  target_original_filename text,
  target_mime_type text,
  target_file_size_bytes bigint,
  target_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_row record;
  template_row record;
  next_revision integer;
  new_revision_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    document.id,
    document.allocation_id,
    document.template_id,
    document.status,
    document.storage_path,
    document.current_revision_number
  into document_row
  from public.teaching_documents
    as document
  where document.id =
    target_document_id
  for update;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  if not public.teaching_document_actor_can_manage_allocation(
    document_row.allocation_id
  ) then
    raise exception
      'This teaching document is outside your access.'
      using errcode = '42501';
  end if;

  select
    template.mime_type,
    template.sha256
  into template_row
  from public.teaching_document_templates
    as template
  where template.id =
    document_row.template_id;

  if not found then
    raise exception
      'The source institutional template was not found.'
      using errcode = 'P0002';
  end if;

  if target_source not in (
    'template_copy',
    'trainer_upload'
  ) then
    raise exception
      'Unsupported teaching-document revision source.'
      using errcode = '23514';
  end if;

  if target_storage_bucket <>
    'teaching-documents-private'
  then
    raise exception
      'Unsupported storage bucket.'
      using errcode = '23514';
  end if;

  if target_storage_path is null
     or trim(target_storage_path) = ''
     or target_storage_path not like
       (
         'documents/' ||
         target_document_id::text ||
         '/%'
       )
  then
    raise exception
      'Teaching-document storage path is invalid.'
      using errcode = '23514';
  end if;

  if target_original_filename is null
     or trim(target_original_filename) = ''
  then
    raise exception
      'Working filename is required.'
      using errcode = '23514';
  end if;

  if target_mime_type is null
     or target_mime_type <>
       template_row.mime_type
  then
    raise exception
      'Working file must use the same file type as the official institutional template.'
      using errcode = '23514';
  end if;

  if target_file_size_bytes is null
     or target_file_size_bytes <= 0
     or target_file_size_bytes > 15728640
  then
    raise exception
      'Working file size is invalid.'
      using errcode = '23514';
  end if;

  if target_sha256 is null
     or target_sha256 !~
       '^[0-9a-f]{64}$'
  then
    raise exception
      'Working file SHA-256 is invalid.'
      using errcode = '23514';
  end if;

  if target_source =
       'template_copy'
  then
    if document_row.status <>
       'draft'
    then
      raise exception
        'The institutional template copy can only initialise a draft teaching document.'
        using errcode = '23514';
    end if;

    if document_row.current_revision_number is not null
       or document_row.storage_path is not null
    then
      raise exception
        'This teaching document already has a working file.'
        using errcode = '23505';
    end if;

    if template_row.sha256 is null
       or target_sha256 <>
         template_row.sha256
    then
      raise exception
        'The initial working file must be an exact copy of the registered institutional template.'
        using errcode = '23514';
    end if;
  else
    if document_row.status not in (
      'generated',
      'returned'
    ) then
      raise exception
        'A trainer upload is only allowed while the document is being prepared or corrected.'
        using errcode = '23514';
    end if;
  end if;

  select
    coalesce(
      max(revision.revision_number),
      0
    ) + 1
  into next_revision
  from public.teaching_document_revisions
    as revision
  where revision.document_id =
    target_document_id;

  insert into public.teaching_document_revisions (
    document_id,
    revision_number,
    source,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    file_size_bytes,
    sha256,
    created_by
  )
  values (
    target_document_id,
    next_revision,
    target_source,
    target_storage_bucket,
    target_storage_path,
    trim(target_original_filename),
    target_mime_type,
    target_file_size_bytes,
    target_sha256,
    auth.uid()
  )
  returning id
  into new_revision_id;

  update public.teaching_documents
  set
    status = 'generated',
    storage_bucket =
      target_storage_bucket,
    storage_path =
      target_storage_path,
    original_filename =
      trim(target_original_filename),
    mime_type =
      target_mime_type,
    file_size_bytes =
      target_file_size_bytes,
    sha256 =
      target_sha256,
    current_revision_number =
      next_revision,
    generated_at =
      coalesce(
        generated_at,
        now()
      ),
    updated_at =
      now(),
    updated_by =
      auth.uid()
  where id =
    target_document_id;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'revisionId',
    new_revision_id,
    'revisionNumber',
    next_revision,
    'status',
    'generated'
  );
end;
$$;

revoke all
on function public.record_teaching_document_revision(
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
)
from public;

grant execute
on function public.record_teaching_document_revision(
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Submit the exact current revision for HOD review.
-- ----------------------------------------------------------------------------

create or replace function public.submit_teaching_document(
  target_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_row record;
  submission_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    document.id,
    document.allocation_id,
    document.status,
    document.storage_path,
    document.current_revision_number
  into document_row
  from public.teaching_documents
    as document
  where document.id =
    target_document_id
  for update;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  if not public.teaching_document_actor_can_manage_allocation(
    document_row.allocation_id
  ) then
    raise exception
      'This teaching document is outside your access.'
      using errcode = '42501';
  end if;

  if document_row.status not in (
    'generated',
    'returned'
  ) then
    raise exception
      'Only a prepared or returned teaching document can be submitted.'
      using errcode = '23514';
  end if;

  if document_row.storage_path is null
     or document_row.current_revision_number is null
  then
    raise exception
      'Upload the working document before submission.'
      using errcode = '23514';
  end if;

  insert into public.teaching_document_submissions (
    document_id,
    revision_number,
    submitted_by
  )
  values (
    target_document_id,
    document_row.current_revision_number,
    auth.uid()
  )
  returning id
  into submission_id;

  update public.teaching_documents
  set
    status =
      'submitted',
    submitted_at =
      now(),
    submitted_revision_number =
      document_row.current_revision_number,
    updated_at =
      now(),
    updated_by =
      auth.uid()
  where id =
    target_document_id;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'submissionId',
    submission_id,
    'revisionNumber',
    document_row.current_revision_number,
    'status',
    'submitted'
  );
end;
$$;

revoke all
on function public.submit_teaching_document(uuid)
from public;

grant execute
on function public.submit_teaching_document(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- HOD/system-admin review. A returned document becomes editable again.
-- Approval freezes the exact submitted revision as the approved revision.
-- ----------------------------------------------------------------------------

create or replace function public.review_teaching_document(
  target_document_id uuid,
  target_decision text,
  target_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_row record;
  review_id uuid;
  clean_note text;
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
      'Only an authorized HOD or system administrator may review teaching documents.'
      using errcode = '42501';
  end if;

  if target_decision not in (
    'approved',
    'returned'
  ) then
    raise exception
      'Unsupported review decision.'
      using errcode = '23514';
  end if;

  clean_note =
    nullif(
      trim(
        coalesce(
          target_note,
          ''
        )
      ),
      ''
    );

  if target_decision =
       'returned'
     and clean_note is null
  then
    raise exception
      'A correction note is required when returning a teaching document.'
      using errcode = '23514';
  end if;

  select
    document.id,
    document.status,
    document.submitted_revision_number
  into document_row
  from public.teaching_documents
    as document
  where document.id =
    target_document_id
  for update;

  if not found then
    raise exception
      'Teaching document was not found.'
      using errcode = 'P0002';
  end if;

  if document_row.status <>
       'submitted'
     or document_row.submitted_revision_number is null
  then
    raise exception
      'Only a submitted teaching document can be reviewed.'
      using errcode = '23514';
  end if;

  insert into public.teaching_document_reviews (
    document_id,
    revision_number,
    decision,
    note,
    reviewed_by
  )
  values (
    target_document_id,
    document_row.submitted_revision_number,
    target_decision,
    clean_note,
    auth.uid()
  )
  returning id
  into review_id;

  if target_decision =
       'approved'
  then
    update public.teaching_documents
    set
      status =
        'approved',
      approved_at =
        now(),
      approved_by =
        auth.uid(),
      approved_revision_number =
        document_row.submitted_revision_number,
      review_note =
        clean_note,
      returned_at =
        null,
      returned_by =
        null,
      updated_at =
        now(),
      updated_by =
        auth.uid()
    where id =
      target_document_id;
  else
    update public.teaching_documents
    set
      status =
        'returned',
      returned_at =
        now(),
      returned_by =
        auth.uid(),
      review_note =
        clean_note,
      approved_at =
        null,
      approved_by =
        null,
      approved_revision_number =
        null,
      updated_at =
        now(),
      updated_by =
        auth.uid()
    where id =
      target_document_id;
  end if;

  return jsonb_build_object(
    'documentId',
    target_document_id,
    'reviewId',
    review_id,
    'revisionNumber',
    document_row.submitted_revision_number,
    'status',
    target_decision
  );
end;
$$;

revoke all
on function public.review_teaching_document(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.review_teaching_document(
  uuid,
  text,
  text
)
to authenticated;

comment on table public.teaching_document_revisions is
  'Immutable private working-file revisions for one allocation-scoped teaching document.';

comment on table public.teaching_document_submissions is
  'Immutable teaching-document submission history, including the exact submitted revision.';

comment on table public.teaching_document_reviews is
  'Immutable HOD/system-admin review decisions for submitted teaching documents.';

comment on function public.record_teaching_document_revision(
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
) is
  'Registers an exact template working copy or trainer-uploaded revision after private Storage upload.';

comment on function public.submit_teaching_document(uuid) is
  'Submits the current teaching-document revision for HOD review.';

comment on function public.review_teaching_document(
  uuid,
  text,
  text
) is
  'Approves or returns the exact submitted teaching-document revision.';

commit;
