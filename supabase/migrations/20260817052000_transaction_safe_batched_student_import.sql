-- Transaction-safe batched student import.
-- Each RPC invocation processes at most 25 rows (caller may request 1..50),
-- so every batch commits independently and a retry resumes from rows still marked valid.

create or replace function public.import_student_rows_batch(
  target_batch_id uuid,
  requested_batch_size integer default 25
)
returns table(
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer,
  remaining_count integer,
  completed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged public.import_rows%rowtype;
  created_student_id uuid;
  existing_student_id uuid;
  normalized jsonb;
  admission_date_value date;
  current_effective_date date;
  status_effective_date date;
  lifecycle_value public.student_lifecycle_status;
  phase_value public.student_academic_phase;
  event_type_value public.student_lifecycle_event_type;
  normalized_kcse text;
  safe_batch_size integer := greatest(1, least(coalesce(requested_batch_size, 25), 50));
  remaining integer := 0;
  imported_total integer := 0;
  skipped_total integer := 0;
  failed_total integer := 0;
begin
  select *
  into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null or selected_batch.entity_type::text <> 'students' then
    raise exception 'Student import batch not found';
  end if;

  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception 'You cannot import students into this department';
  end if;

  if selected_batch.status in ('completed', 'completed_with_errors') then
    perform public.refresh_import_batch_counts(target_batch_id);
    select b.imported_rows, b.skipped_rows, b.failed_rows
      into imported_total, skipped_total, failed_total
    from public.import_batches b where b.id = target_batch_id;
    return query select target_batch_id, imported_total, skipped_total, failed_total, 0, true;
    return;
  end if;

  if selected_batch.status not in ('validated', 'importing') then
    raise exception 'Student import batch must be validated before import';
  end if;

  if selected_batch.status = 'validated' then
    -- Rows already identified as invalid/duplicate are not import candidates.
    -- Convert them once so batch skipped counts remain meaningful.
    update public.import_rows
    set status = 'skipped', updated_at = now()
    where import_batch_id = target_batch_id
      and status in ('invalid', 'duplicate');

    update public.import_batches
    set status = 'importing'::public.import_batch_status,
        started_at = coalesce(started_at, now()),
        completed_at = null,
        failure_message = null,
        updated_at = now()
    where id = target_batch_id;
  end if;

  for staged in
    select *
    from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    limit safe_batch_size
    for update skip locked
  loop
    begin
      normalized := staged.normalized_data;
      admission_date_value := nullif(normalized->>'admissionDate', '')::date;
      current_effective_date := nullif(normalized->>'currentCohortEffectiveDate', '')::date;
      status_effective_date := nullif(normalized->>'statusEffectiveDate', '')::date;
      lifecycle_value := (normalized->>'lifecycleStatus')::public.student_lifecycle_status;

      if lifecycle_value::text not in ('active', 'deferred', 'dropped_out', 'completed', 'graduated') then
        raise exception 'Unsupported departmental lifecycle status';
      end if;

      phase_value := (normalized->>'academicPhase')::public.student_academic_phase;
      normalized_kcse := nullif(regexp_replace(coalesce(normalized->>'kcseIndexNumber', ''), '\\s+', '', 'g'), '');
      if normalized_kcse ~ '^[0-9]{11}$' then
        normalized_kcse := substr(normalized_kcse, 1, 8) || '/' || substr(normalized_kcse, 9, 3);
      end if;

      -- Idempotency guard. If this admission number already exists, do not create
      -- a second student. This also makes retries safe after an interrupted request.
      existing_student_id := null;
      select s.id
      into existing_student_id
      from public.students s
      where s.department_id = selected_batch.department_id
        and upper(trim(s.admission_number)) = upper(trim(normalized->>'admissionNumber'))
      limit 1;

      if existing_student_id is not null then
        update public.import_rows
        set status = 'skipped',
            imported_record_id = existing_student_id,
            row_errors = coalesce(row_errors, '[]'::jsonb) || jsonb_build_array('Student already exists; retry-safe import skipped this row.'),
            updated_at = now()
        where id = staged.id;
        continue;
      end if;

      insert into public.students(
        department_id, programme_id, admission_cohort_id, current_cohort_id,
        admission_number, full_name, lifecycle_status, academic_phase,
        admission_date, projected_completion_date, completion_date, graduation_date,
        kcse_index_number, national_id_number,
        admission_number_inference, notes
      ) values (
        selected_batch.department_id,
        (normalized->>'programmeId')::uuid,
        (normalized->>'admissionCohortId')::uuid,
        (normalized->>'currentCohortId')::uuid,
        normalized->>'admissionNumber',
        normalized->>'fullName',
        lifecycle_value,
        phase_value,
        admission_date_value,
        nullif(normalized->>'projectedCompletionDate', '')::date,
        case when lifecycle_value in ('completed', 'graduated') then status_effective_date else null end,
        case when lifecycle_value = 'graduated' then status_effective_date else null end,
        normalized_kcse,
        nullif(regexp_replace(coalesce(normalized->>'nationalIdNumber', ''), '\\s+', '', 'g'), ''),
        coalesce(normalized->'inference', '{}'::jsonb),
        nullif(normalized->>'notes', '')
      ) returning id into created_student_id;

      if normalized->>'currentCohortId' = normalized->>'admissionCohortId' then
        insert into public.student_cohort_assignments(
          student_id, cohort_id, effective_from, is_admission_cohort, assignment_reason, notes
        ) values (
          created_student_id, (normalized->>'admissionCohortId')::uuid,
          coalesce(admission_date_value, current_date), true,
          'Admission cohort', 'Created during controlled student onboarding'
        );
      elsif normalized->'resolutionSource'->>'currentCohort' = 'progression_group' then
        insert into public.student_cohort_assignments(
          student_id, cohort_id, effective_from, is_admission_cohort, assignment_reason, notes
        ) values (
          created_student_id, (normalized->>'currentCohortId')::uuid,
          coalesce(current_effective_date, admission_date_value, current_date), false,
          'JAN/MAR progression group at onboarding',
          'Admission intake remains preserved separately on the student record'
        );
      else
        insert into public.student_cohort_assignments(
          student_id, cohort_id, effective_from, effective_to,
          is_admission_cohort, assignment_reason, notes
        ) values (
          created_student_id, (normalized->>'admissionCohortId')::uuid,
          coalesce(admission_date_value, current_effective_date), current_effective_date - 1,
          true, 'Admission cohort', 'Historical admission cohort created during onboarding'
        );

        insert into public.student_cohort_assignments(
          student_id, cohort_id, effective_from, is_admission_cohort, assignment_reason, notes
        ) values (
          created_student_id, (normalized->>'currentCohortId')::uuid,
          current_effective_date, false, 'Current study cohort at onboarding',
          nullif(normalized->>'statusReason', '')
        );

        insert into public.student_lifecycle_events(
          student_id, event_type, effective_date, from_cohort_id, to_cohort_id, reason
        ) values (
          created_student_id, 'cohort_change', current_effective_date,
          (normalized->>'admissionCohortId')::uuid, (normalized->>'currentCohortId')::uuid,
          'Current cohort supplied during controlled onboarding'
        );
      end if;

      insert into public.student_lifecycle_events(student_id, event_type, effective_date, to_cohort_id, reason)
      values (
        created_student_id, 'admission', coalesce(admission_date_value, current_date),
        (normalized->>'admissionCohortId')::uuid, 'Student admitted to programme'
      );

      event_type_value := case lifecycle_value
        when 'deferred' then 'deferral'::public.student_lifecycle_event_type
        when 'dropped_out' then 'dropout'::public.student_lifecycle_event_type
        when 'completed' then 'programme_completion'::public.student_lifecycle_event_type
        when 'graduated' then 'graduation'::public.student_lifecycle_event_type
        else null
      end;

      if event_type_value is not null and status_effective_date is not null then
        insert into public.student_lifecycle_events(student_id, event_type, effective_date, reason)
        values (created_student_id, event_type_value, status_effective_date, nullif(normalized->>'statusReason', ''));
      end if;

      update public.import_rows
      set status = 'imported', imported_record_id = created_student_id,
          imported_at = now(), updated_at = now()
      where id = staged.id;
    exception when others then
      update public.import_rows
      set status = 'failed',
          row_errors = coalesce(row_errors, '[]'::jsonb) || jsonb_build_array(sqlerrm),
          updated_at = now()
      where id = staged.id;
    end;
  end loop;

  select count(*)::integer
  into remaining
  from public.import_rows
  where import_batch_id = target_batch_id
    and status = 'valid';

  perform public.refresh_import_batch_counts(target_batch_id);

  select b.imported_rows, b.skipped_rows, b.failed_rows
  into imported_total, skipped_total, failed_total
  from public.import_batches b
  where b.id = target_batch_id;

  if remaining = 0 then
    update public.import_batches
    set status = case
          when failed_total > 0 then 'completed_with_errors'::public.import_batch_status
          else 'completed'::public.import_batch_status
        end,
        completed_at = now(),
        updated_at = now()
    where id = target_batch_id;
  else
    update public.import_batches
    set status = 'importing'::public.import_batch_status,
        updated_at = now()
    where id = target_batch_id;
  end if;

  return query
  select target_batch_id, imported_total, skipped_total, failed_total, remaining, remaining = 0;
end;
$$;

revoke all on function public.import_student_rows_batch(uuid, integer) from public;
grant execute on function public.import_student_rows_batch(uuid, integer) to authenticated;

comment on function public.import_student_rows_batch(uuid, integer) is
  'Processes a bounded student-import batch in one transaction. Repeated calls resume safely from remaining valid rows.';
