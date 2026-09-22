-- ============================================================
-- Transactional Semester Units on Offer import
--
-- Imports only validated staged rows.
-- Preserves manually reviewed Unit Offering decisions.
-- Creates or reuses Teaching Offerings.
-- Groups rows sharing an Academic Period and shared-class key.
-- ============================================================

create or replace function
  public.import_valid_unit_offering_rows(
    target_batch_id uuid
  )
returns table (
  batch_id uuid,
  imported_count integer,
  updated_count integer,
  skipped_count integer,
  failed_count integer,
  shared_offering_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch
    public.import_batches%rowtype;

  staged_row
    public.import_rows%rowtype;

  normalized jsonb;

  selected_existing
    public.unit_offerings%rowtype;

  selected_unit
    public.units%rowtype;

  created_unit_offering_id uuid;
  selected_teaching_offering_id uuid;
  existing_participant_offering_id uuid;

  academic_period_id_value uuid;
  cohort_id_value uuid;
  unit_id_value uuid;
  preferred_trainer_id_value uuid;
  preferred_room_id_value uuid;

  offering_type_value
    public.unit_offering_type;

  unit_status_value
    public.unit_offering_status;

  teaching_status_value
    public.teaching_allocation_status;

  delivery_mode_value
    public.teaching_delivery_mode;

  weekly_sessions_value integer;
  session_duration_value integer;
  timetable_enabled_value boolean;

  shared_key_value text;
  notes_value text;
  operation_value text;

  imported_total integer := 0;
  updated_total integer := 0;
  skipped_total integer := 0;
  failed_total integer := 0;
  shared_total integer := 0;
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
        'You are not authorized to import Semester Units on Offer';
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
      'unit_offerings'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected batch is not a Units on Offer import';
  end if;

  if selected_batch.status <>
      'validated'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Only validated Units on Offer batches can be confirmed';
  end if;

  update public.import_batches
  set
    status = 'importing',
    failure_message = null
  where id = target_batch_id;

  /*
   * Invalid and duplicate rows remain in the audit trail
   * but cannot modify academic data.
   */
  update public.import_rows
  set
    status = 'skipped',
    imported_at = now()
  where import_batch_id =
      target_batch_id
    and status in (
      'invalid',
      'duplicate'
    );

  get diagnostics
    skipped_total = row_count;

  for staged_row in
    select *
    from public.import_rows
    where import_batch_id =
        target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized :=
      staged_row.normalized_data;

    academic_period_id_value :=
      (
        normalized ->>
          'academicPeriodId'
      )::uuid;

    cohort_id_value :=
      (
        normalized ->>
          'cohortId'
      )::uuid;

    unit_id_value :=
      (
        normalized ->>
          'unitId'
      )::uuid;

    preferred_trainer_id_value :=
      case
        when nullif(
          normalized ->>
            'preferredTrainerId',
          ''
        ) is null
          then null
        else (
          normalized ->>
            'preferredTrainerId'
        )::uuid
      end;

    preferred_room_id_value :=
      case
        when nullif(
          normalized ->>
            'preferredRoomId',
          ''
        ) is null
          then null
        else (
          normalized ->>
            'preferredRoomId'
        )::uuid
      end;

    offering_type_value :=
      (
        normalized ->>
          'offeringType'
      )::public.unit_offering_type;

    unit_status_value :=
      (
        normalized ->>
          'status'
      )::public.unit_offering_status;

    teaching_status_value :=
      case
        when unit_status_value =
          'active'
          then 'active'
            ::public.teaching_allocation_status
        else 'draft'
          ::public.teaching_allocation_status
      end;

    delivery_mode_value :=
      case
        when offering_type_value =
          'practical'
          then 'practical'
            ::public.teaching_delivery_mode
        else 'theory'
          ::public.teaching_delivery_mode
      end;

    weekly_sessions_value :=
      (
        normalized ->>
          'weeklySessions'
      )::integer;

    session_duration_value :=
      (
        normalized ->>
          'sessionDurationMinutes'
      )::integer;

    timetable_enabled_value :=
      coalesce(
        (
          normalized ->>
            'timetableEnabled'
        )::boolean,
        false
      );

    shared_key_value :=
      public.normalize_shared_class_key(
        normalized ->>
          'sharedClassKey'
      );

    notes_value :=
      nullif(
        trim(
          coalesce(
            normalized ->>
              'notes',
            ''
          )
        ),
        ''
      );

    operation_value :=
      coalesce(
        normalized ->>
          'importOperation',
        'insert'
      );

    /*
     * Revalidate the resolved relationships inside the
     * transaction. Staged IDs must still represent a valid
     * programme-specific cohort/unit relationship.
     */
    select *
    into selected_unit
    from public.units
    where id = unit_id_value;

    if selected_unit.id is null then
      raise exception using
        errcode = 'P0002',
        message =
          format(
            'Unit referenced by spreadsheet row %s was not found',
            staged_row.source_row_number
          );
    end if;

    if not exists (
      select 1
      from public.cohorts cohort
      where cohort.id =
          cohort_id_value
        and cohort.programme_id =
          selected_unit.programme_id
    ) then
      raise exception using
        errcode = '23514',
        message =
          format(
            'Spreadsheet row %s contains a cohort and unit from different programmes',
            staged_row.source_row_number
          );
    end if;

    select *
    into selected_existing
    from public.unit_offerings
    where academic_period_id =
        academic_period_id_value
      and cohort_id =
        cohort_id_value
      and unit_id =
        unit_id_value
    for update;

    /*
     * A manually reviewed decision is authoritative.
     * The spreadsheet remains audited, but cannot overwrite it.
     */
    if selected_existing.id is not null
       and selected_existing.manually_reviewed
    then
      update public.import_rows
      set
        status = 'skipped',
        imported_record_id =
          selected_existing.id,
        imported_at = now(),
        row_errors =
          jsonb_build_array(
            'Existing manually reviewed Unit Offering was preserved.'
          )
      where id = staged_row.id;

      skipped_total :=
        skipped_total + 1;

      continue;
    end if;

    if selected_existing.id is null then
      insert into public.unit_offerings (
        academic_period_id,
        cohort_id,
        unit_id,
        offering_type,
        status,
        is_timetable_enabled,
        weekly_sessions,
        session_duration_minutes,
        delivery_notes,
        source,
        origin,
        selection_state,
        recommended_stage_number,
        exception_reason,
        manually_reviewed,
        created_by,
        updated_by
      )
      values (
        academic_period_id_value,
        cohort_id_value,
        unit_id_value,
        offering_type_value,
        unit_status_value,
        timetable_enabled_value,
        weekly_sessions_value,
        session_duration_value,
        notes_value,
        'semester_offering_import',
        'import'
          ::public.unit_offering_origin,
        'included'
          ::public.unit_offering_selection_state,
        selected_unit.academic_period_number,
        null,
        false,
        auth.uid(),
        auth.uid()
      )
      returning id
      into created_unit_offering_id;

      imported_total :=
        imported_total + 1;
    else
      update public.unit_offerings
      set
        offering_type =
          offering_type_value,
        status =
          unit_status_value,
        is_timetable_enabled =
          timetable_enabled_value,
        weekly_sessions =
          weekly_sessions_value,
        session_duration_minutes =
          session_duration_value,
        delivery_notes =
          notes_value,
        source =
          'semester_offering_import',
        origin =
          'import'
            ::public.unit_offering_origin,
        selection_state =
          'included'
            ::public.unit_offering_selection_state,
        updated_by =
          auth.uid()
      where id =
          selected_existing.id
      returning id
      into created_unit_offering_id;

      updated_total :=
        updated_total + 1;
    end if;

    /*
     * Reuse the Teaching Offering already connected to this
     * Unit on Offer when the record is being updated.
     */
    select
      participant.teaching_offering_id
    into existing_participant_offering_id
    from public.teaching_offering_participants
      participant
    where participant.unit_offering_id =
        created_unit_offering_id
    limit 1;

    selected_teaching_offering_id :=
      existing_participant_offering_id;

    /*
     * Shared rows resolve to one Academic Period-scoped
     * Teaching Offering.
     */
    if selected_teaching_offering_id is null
       and shared_key_value is not null
    then
      select offering.id
      into selected_teaching_offering_id
      from public.teaching_offerings
        offering
      where offering.academic_period_id =
          academic_period_id_value
        and offering.shared_class_key =
          shared_key_value
      for update;

      if selected_teaching_offering_id is null then
        insert into public.teaching_offerings (
          academic_period_id,
          title,
          shared_class_key,
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
          academic_period_id_value,
          normalized ->>
            'unitName',
          shared_key_value,
          preferred_trainer_id_value,
          preferred_room_id_value,
          delivery_mode_value,
          weekly_sessions_value,
          session_duration_value,
          teaching_status_value,
          timetable_enabled_value,
          notes_value,
          auth.uid(),
          auth.uid()
        )
        returning id
        into selected_teaching_offering_id;

        shared_total :=
          shared_total + 1;
      end if;
    end if;

    /*
     * Rows without a shared key receive an independent
     * Teaching Offering.
     */
    if selected_teaching_offering_id is null then
      insert into public.teaching_offerings (
        academic_period_id,
        title,
        shared_class_key,
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
        academic_period_id_value,
        normalized ->>
          'unitName',
        null,
        preferred_trainer_id_value,
        preferred_room_id_value,
        delivery_mode_value,
        weekly_sessions_value,
        session_duration_value,
        teaching_status_value,
        timetable_enabled_value,
        notes_value,
        auth.uid(),
        auth.uid()
      )
      returning id
      into selected_teaching_offering_id;
    end if;

    /*
     * A participant retains the exact cohort, official unit and
     * authoritative Unit on Offer represented in the workbook.
     */
    insert into public.teaching_offering_participants (
      teaching_offering_id,
      cohort_id,
      unit_id,
      unit_offering_id,
      is_primary,
      notes,
      created_by,
      updated_by
    )
    values (
      selected_teaching_offering_id,
      cohort_id_value,
      unit_id_value,
      created_unit_offering_id,
      not exists (
        select 1
        from public.teaching_offering_participants
        where teaching_offering_id =
          selected_teaching_offering_id
          and is_primary
      ),
      notes_value,
      auth.uid(),
      auth.uid()
    )
    on conflict (
      teaching_offering_id,
      cohort_id
    )
    do update
    set
      unit_id =
        excluded.unit_id,
      unit_offering_id =
        excluded.unit_offering_id,
      notes =
        excluded.notes,
      updated_by =
        auth.uid();

    update public.import_rows
    set
      status = 'imported',
      imported_record_id =
        created_unit_offering_id,
      imported_at = now(),
      row_errors = '[]'::jsonb
    where id = staged_row.id;
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
        true,
        'inserted_rows',
        imported_total,
        'updated_rows',
        updated_total,
        'skipped_rows',
        skipped_total,
        'shared_offerings_created',
        shared_total
      )
  where id = target_batch_id;

  return query
  select
    target_batch_id,
    imported_total,
    updated_total,
    skipped_total,
    failed_total,
    shared_total;
end;
$$;

revoke all
on function
  public.import_valid_unit_offering_rows(uuid)
from public;

grant execute
on function
  public.import_valid_unit_offering_rows(uuid)
to authenticated;

comment on function
  public.import_valid_unit_offering_rows(uuid)
is
  'Atomically imports valid staged Semester Units on Offer, preserves manually reviewed decisions, and creates or reuses shared Teaching Offerings and programme-specific participants.';