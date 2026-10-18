begin;

-- Auto-import confidently title-matched parser records while leaving uncertain
-- but otherwise usable papers in the review queue for manual unit matching.
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
  has_pending_usable boolean;
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
    where item.batch_id = batch_record.id
      and item.review_status = 'ready'
      and item.import_status in ('usable', 'usable_with_notes')
  ) and exists (
    select 1 from public.exam_import_items item
    where item.batch_id = batch_record.id
      and item.review_status = 'pending'
      and item.import_status in ('usable', 'usable_with_notes')
  ) then
    raise exception 'There are no ready papers to import; usable papers still need review';
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
        or unit.is_active is not true
      )
  ) then
    raise exception 'Every ready paper needs a valid active unit in this department';
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

  update public.exam_import_items
  set review_status = 'rejected'
  where batch_id = batch_record.id
    and review_status = 'pending'
    and import_status not in ('usable', 'usable_with_notes');

  select exists (
    select 1
    from public.exam_import_items item
    where item.batch_id = batch_record.id
      and item.review_status = 'pending'
      and item.import_status in ('usable', 'usable_with_notes')
  ) into has_pending_usable;

  update public.exam_import_batches
  set status = case when has_pending_usable then 'reviewing' else 'imported' end,
      imported_at = case when has_pending_usable then null else now() end
  where id = batch_record.id;

  if imported_count > 0 then
    insert into public.exam_audit_log (department_id, actor_id, action, detail)
    values (
      batch_record.department_id,
      auth.uid(),
      'exam_source_imported',
      jsonb_build_object('batch_id', batch_record.id, 'source_count', imported_count)
    );
  end if;

  return imported_count;
end;
$$;

revoke all on function public.exam_commit_import_batch(uuid) from public;
grant execute on function public.exam_commit_import_batch(uuid) to authenticated;

create or replace function public.exam_import_partial_commit_enabled()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select true;
$$;

revoke all on function public.exam_import_partial_commit_enabled() from public;
grant execute on function public.exam_import_partial_commit_enabled() to authenticated;

commit;
