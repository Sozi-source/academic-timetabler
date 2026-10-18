begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-imports',
  'exam-imports',
  false,
  52428800,
  array['application/x-ndjson', 'application/json', 'text/plain']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.exam_import_batches (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  source_filename text not null check (length(trim(source_filename)) between 1 and 255),
  storage_path text not null check (length(trim(storage_path)) > 0),
  total_records integer not null check (total_records between 1 and 1000),
  status text not null default 'reviewing'
    check (status in ('reviewing', 'imported', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

create index if not exists exam_import_batches_department_created_idx
  on public.exam_import_batches (department_id, created_at desc);

create table if not exists public.exam_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.exam_import_batches(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  source_path text not null,
  exam_year smallint check (exam_year is null or exam_year between 2000 and 2100),
  series text check (series is null or series in ('JAN-APR', 'MAY-AUG', 'SEP-DEC')),
  trainer_name text,
  paper_kind text check (paper_kind is null or paper_kind in ('main', 'supplementary')),
  unit_code text,
  import_status text not null check (import_status in (
    'usable', 'usable_with_notes', 'unread_parts', 'unreadable',
    'ignored:scheme', 'ignored:outline'
  )),
  parse_error text,
  parse_notes jsonb not null default '[]'::jsonb,
  paper_data jsonb,
  paper_preview jsonb not null default '[]'::jsonb,
  unit_id uuid references public.units(id) on delete restrict,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'ready', 'rejected', 'imported')),
  source_file_id uuid references public.exam_source_files(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, source_path)
);

create index if not exists exam_import_items_batch_review_idx
  on public.exam_import_items (batch_id, review_status, import_status);
create index if not exists exam_import_items_department_unit_idx
  on public.exam_import_items (department_id, unit_id, review_status);

alter table public.exam_import_batches enable row level security;
alter table public.exam_import_items enable row level security;

drop policy if exists exam_import_batches_hod_all on public.exam_import_batches;
create policy exam_import_batches_hod_all
on public.exam_import_batches
for all to authenticated
using (public.current_user_can_manage_department(department_id))
with check (public.current_user_can_manage_department(department_id));

drop policy if exists exam_import_items_hod_all on public.exam_import_items;
create policy exam_import_items_hod_all
on public.exam_import_items
for all to authenticated
using (public.current_user_can_manage_department(department_id))
with check (
  public.current_user_can_manage_department(department_id)
  and exists (
    select 1 from public.exam_import_batches batch
    where batch.id = exam_import_items.batch_id
      and batch.department_id = exam_import_items.department_id
  )
);

-- Historical exam papers remain confidential to HODs/system administrators.
-- Trainers may still read non-exam notes/guides for their allocated units.
drop policy if exists exam_source_files_trainer_read on public.exam_source_files;
create policy exam_source_files_trainer_read
on public.exam_source_files
for select
to authenticated
using (
  source_type in ('notes', 'format_guide')
  and public.current_trainer_teaches_unit(unit_id)
  and public.current_user_can_access_department(department_id)
);

create or replace function public.exam_commit_import_batch(requested_batch uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  batch_record public.exam_import_batches%rowtype;
  item_record public.exam_import_items%rowtype;
  inserted_source_id uuid;
  imported_count integer := 0;
begin
  select * into batch_record
  from public.exam_import_batches
  where id = requested_batch
  for update;

  if not found
    or not public.current_user_can_manage_department(batch_record.department_id) then
    raise exception 'Import batch not found or access denied';
  end if;
  if batch_record.status <> 'reviewing' then
    raise exception 'Import batch is not awaiting review';
  end if;
  if not exists (
    select 1 from public.exam_import_items item
    where item.batch_id = batch_record.id and item.review_status = 'ready'
  ) then
    raise exception 'Mark at least one usable paper as ready before importing';
  end if;
  if exists (
    select 1
    from public.exam_import_items item
    left join public.units unit on unit.id = item.unit_id
    where item.batch_id = batch_record.id
      and item.review_status = 'ready'
      and (
        item.import_status not in ('usable', 'usable_with_notes')
        or item.unit_id is null
        or unit.department_id is distinct from batch_record.department_id
      )
  ) then
    raise exception 'Every ready paper needs a valid unit in this department';
  end if;

  for item_record in
    select * from public.exam_import_items item
    where item.batch_id = batch_record.id and item.review_status = 'ready'
    order by item.source_path
    for update
  loop
    insert into public.exam_source_files (
      department_id, unit_id, source_type, exam_year, paper_kind, series,
      trainer_name, unit_code, parse_notes, storage_path, original_filename,
      mime_type, parse_status, extracted_text, parsed_at, uploaded_by
    ) values (
      batch_record.department_id,
      item_record.unit_id,
      'past_paper',
      item_record.exam_year,
      item_record.paper_kind,
      item_record.series,
      item_record.trainer_name,
      item_record.unit_code,
      item_record.parse_notes,
      batch_record.storage_path,
      regexp_replace(replace(item_record.source_path, chr(92), '/'), '^.*/', ''),
      'application/x-ndjson',
      case when item_record.import_status = 'usable'
        then 'parsed' else 'needs_review' end,
      item_record.paper_data::text,
      now(),
      batch_record.created_by
    ) returning id into inserted_source_id;

    update public.exam_import_items
    set review_status = 'imported', source_file_id = inserted_source_id
    where id = item_record.id;
    imported_count := imported_count + 1;
  end loop;

  update public.exam_import_batches
  set status = 'imported', imported_at = now()
  where id = batch_record.id;

  insert into public.exam_audit_log (department_id, actor_id, action, detail)
  values (
    batch_record.department_id,
    auth.uid(),
    'exam_source_imported',
    jsonb_build_object('batch_id', batch_record.id, 'source_count', imported_count)
  );

  return imported_count;
end;
$$;
revoke all on function public.exam_commit_import_batch(uuid) from public;
grant execute on function public.exam_commit_import_batch(uuid) to authenticated;

commit;
