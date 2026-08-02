-- ============================================================
-- HND App: Transactional Teaching Allocation Bulk Import
-- ============================================================

create or replace function
  public.import_valid_teaching_allocation_rows(
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

  created_allocation_id uuid;

  allocation_period_id uuid;
  allocation_cohort_id uuid;
  allocation_unit_id uuid;
  allocation_trainer_id uuid;
  allocation_room_id uuid;

  allocation_weekly_sessions integer;
  allocation_session_minutes integer;
  allocation_weekly_minutes integer;

  trainer_maximum_weekly_minutes integer;
  existing_trainer_minutes integer;
  staged_trainer_minutes integer;

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
        'You are not authorized to import teaching allocations';
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

  if selected_batch.entity_type <>
    'teaching_allocations'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected batch is not a Teaching Allocations import';
  end if;

  if selected_batch.status <> 'validated' then
    raise exception using
      errcode = 'P0001',
      message =
        'Only validated Teaching Allocation batches can be confirmed';
  end if;

  update public.import_batches
  set
    status = 'importing',
    failure_message = null
  where id = target_batch_id;

  /*
   * Invalid and duplicate spreadsheet rows remain available
   * in the audit history but are not inserted.
   */
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

    allocation_period_id :=
      (
        normalized ->> 'academicPeriodId'
      )::uuid;

    allocation_cohort_id :=
      (
        normalized ->> 'cohortId'
      )::uuid;

    allocation_unit_id :=
      (
        normalized ->> 'unitId'
      )::uuid;

    allocation_trainer_id :=
      (
        normalized ->> 'trainerId'
      )::uuid;

    allocation_room_id :=
      case
        when nullif(
          normalized ->> 'preferredRoomId',
          ''
        ) is null
          then null
        else (
          normalized ->> 'preferredRoomId'
        )::uuid
      end;

    allocation_weekly_sessions :=
      (
        normalized ->> 'weeklySessions'
      )::integer;

    allocation_session_minutes :=
      (
        normalized ->> 'sessionDurationMinutes'
      )::integer;

    allocation_weekly_minutes :=
      allocation_weekly_sessions *
      allocation_session_minutes;

    /*
     * Revalidate the trainer workload inside the same
     * transaction so concurrent imports cannot silently
     * exceed the trainer's configured weekly limit.
     */
    select
      floor(
        maximum_weekly_hours * 60
      )::integer
    into trainer_maximum_weekly_minutes
    from public.trainers
    where id = allocation_trainer_id
    for update;

    if trainer_maximum_weekly_minutes is null then
      raise exception using
        errcode = 'P0002',
        message =
          format(
            'Trainer referenced by spreadsheet row %s was not found',
            staged_row.source_row_number
          );
    end if;

    select
      coalesce(
        sum(
          weekly_sessions *
          session_duration_minutes
        ),
        0
      )::integer
    into existing_trainer_minutes
    from public.teaching_allocations
    where trainer_id =
        allocation_trainer_id
      and academic_period_id =
        allocation_period_id
      and status in (
        'draft',
        'active'
      );

    /*
     * Include allocations imported earlier in this same batch.
     * They are already visible in the current transaction.
     */
    staged_trainer_minutes :=
      existing_trainer_minutes +
      allocation_weekly_minutes;

    if staged_trainer_minutes >
      trainer_maximum_weekly_minutes
    then
      raise exception using
        errcode = 'P0001',
        message =
          format(
            'Spreadsheet row %s would exceed the trainer weekly workload limit',
            staged_row.source_row_number
          );
    end if;

    insert into public.teaching_allocations (
      academic_period_id,
      cohort_id,
      unit_id,
      trainer_id,
      preferred_room_id,
      delivery_mode,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      notes,
      created_by,
      updated_by
    )
    values (
      allocation_period_id,
      allocation_cohort_id,
      allocation_unit_id,
      allocation_trainer_id,
      allocation_room_id,
      (
        normalized ->> 'deliveryMode'
      )::public.teaching_delivery_mode,
      allocation_weekly_sessions,
      allocation_session_minutes,
      (
        normalized ->> 'status'
      )::public.teaching_allocation_status,
      coalesce(
        (
          normalized ->> 'timetableEnabled'
        )::boolean,
        false
      ),
      nullif(
        normalized ->> 'notes',
        ''
      ),
      auth.uid(),
      auth.uid()
    )
    returning id
    into created_allocation_id;

    update public.import_rows
    set
      status = 'imported',
      imported_record_id =
        created_allocation_id,
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
        auth.uid(),
        'transactional',
        true
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
  public.import_valid_teaching_allocation_rows(uuid)
from public;

grant execute
on function
  public.import_valid_teaching_allocation_rows(uuid)
to authenticated;

comment on function
  public.import_valid_teaching_allocation_rows(uuid)
is
  'Atomically imports valid staged Teaching Allocation rows, enforces trainer workload limits, records imported IDs and completes the import audit batch.';