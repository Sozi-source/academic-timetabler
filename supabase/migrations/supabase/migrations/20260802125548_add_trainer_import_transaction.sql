-- ============================================================
-- HND App: Transactional Trainer Bulk Import
-- ============================================================

create or replace function
  public.import_valid_trainer_rows(
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
  created_trainer_id uuid;

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
        'You are not authorized to import trainers';
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

  if selected_batch.entity_type <> 'trainers' then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected import batch is not a Trainer import';
  end if;

  if selected_batch.status <> 'validated' then
    raise exception using
      errcode = 'P0001',
      message =
        'Only validated Trainer import batches can be confirmed';
  end if;

  update public.import_batches
  set
    status = 'importing',
    failure_message = null
  where id = target_batch_id;

  -- Invalid and duplicate rows are retained in the audit
  -- but are not inserted into the Trainers table.
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
    normalized := staged_row.normalized_data;

    insert into public.trainers (
      staff_number,
      full_name,
      email,
      phone_number,
      employment_type,
      specialization,
      qualifications,
      maximum_weekly_hours,
      maximum_daily_hours,
      is_active,
      is_timetable_available,
      notes,
      created_by,
      updated_by
    )
    values (
      normalized ->> 'staffNumber',
      normalized ->> 'fullName',
      nullif(
        normalized ->> 'email',
        ''
      ),
      nullif(
        normalized ->> 'phoneNumber',
        ''
      ),
      (
        normalized ->> 'employmentType'
      )::public.trainer_employment_type,
      nullif(
        normalized ->> 'specialization',
        ''
      ),
      nullif(
        normalized ->> 'qualifications',
        ''
      ),
      (
        normalized ->> 'maximumWeeklyHours'
      )::numeric,
      (
        normalized ->> 'maximumDailyHours'
      )::numeric,
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
    into created_trainer_id;

    update public.import_rows
    set
      status = 'imported',
      imported_record_id =
        created_trainer_id,
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

exception
  when others then
    /*
     * Since the exception is re-raised, PostgreSQL rolls back
     * the entire function transaction, including inserted
     * trainers and staged-row changes.
     */
    raise;
end;
$$;

revoke all
on function
  public.import_valid_trainer_rows(uuid)
from public;

grant execute
on function
  public.import_valid_trainer_rows(uuid)
to authenticated;

comment on function
  public.import_valid_trainer_rows(uuid)
is
  'Atomically imports all valid staged Trainer rows, skips invalid and duplicate rows, records imported IDs and completes the import audit batch.';