-- ============================================================
-- Student Lifecycle Phase 3: intelligent controlled onboarding
-- ============================================================
alter type public.import_entity_type add value if not exists 'students';

create or replace function public.import_valid_student_rows(target_batch_id uuid)
returns table(batch_id uuid, imported_count integer, skipped_count integer, failed_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged public.import_rows%rowtype;
  created_student_id uuid;
  imported integer := 0;
  skipped integer := 0;
  failed integer := 0;
  normalized jsonb;
  admission_date_value date;
  current_effective_date date;
  status_effective_date date;
  event_type_value public.student_lifecycle_event_type;
begin
  select * into selected_batch from public.import_batches where id = target_batch_id for update;
  if selected_batch.id is null or selected_batch.entity_type::text <> 'students' then
    raise exception 'Student import batch not found';
  end if;
  if selected_batch.status <> 'validated' then
    raise exception 'Student import batch must be validated before import';
  end if;
  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception 'You cannot import students into this department';
  end if;

  update public.import_batches set status='importing', started_at=coalesce(started_at,now()), updated_at=now() where id=target_batch_id;

  for staged in select * from public.import_rows where import_batch_id=target_batch_id order by source_row_number loop
    if staged.status <> 'valid' then
      update public.import_rows set status='skipped', updated_at=now() where id=staged.id;
      skipped := skipped + 1;
      continue;
    end if;
    begin
      normalized := staged.normalized_data;
      admission_date_value := nullif(normalized->>'admissionDate','')::date;
      current_effective_date := nullif(normalized->>'currentCohortEffectiveDate','')::date;
      status_effective_date := nullif(normalized->>'statusEffectiveDate','')::date;

      insert into public.students(
        department_id, programme_id, admission_cohort_id, current_cohort_id,
        admission_number, full_name, lifecycle_status, admission_date,
        projected_completion_date, admission_number_inference, notes
      ) values (
        selected_batch.department_id,
        (normalized->>'programmeId')::uuid,
        (normalized->>'admissionCohortId')::uuid,
        (normalized->>'currentCohortId')::uuid,
        normalized->>'admissionNumber', normalized->>'fullName',
        (normalized->>'lifecycleStatus')::public.student_lifecycle_status,
        admission_date_value,
        nullif(normalized->>'projectedCompletionDate','')::date,
        coalesce(normalized->'inference','{}'::jsonb),
        nullif(normalized->>'notes','')
      ) returning id into created_student_id;

      if (normalized->>'currentCohortId') = (normalized->>'admissionCohortId') then
        insert into public.student_cohort_assignments(student_id,cohort_id,effective_from,is_admission_cohort,assignment_reason,notes)
        values(created_student_id,(normalized->>'admissionCohortId')::uuid,coalesce(admission_date_value,current_date),true,'Admission cohort','Created during controlled student onboarding');
      else
        insert into public.student_cohort_assignments(student_id,cohort_id,effective_from,effective_to,is_admission_cohort,assignment_reason,notes)
        values(created_student_id,(normalized->>'admissionCohortId')::uuid,coalesce(admission_date_value,current_effective_date),current_effective_date - 1,true,'Admission cohort','Historical admission cohort created during onboarding');
        insert into public.student_cohort_assignments(student_id,cohort_id,effective_from,is_admission_cohort,assignment_reason,notes)
        values(created_student_id,(normalized->>'currentCohortId')::uuid,current_effective_date,false,'Current study cohort at onboarding',nullif(normalized->>'statusReason',''));
        insert into public.student_lifecycle_events(student_id,event_type,effective_date,from_cohort_id,to_cohort_id,reason)
        values(created_student_id,'cohort_change',current_effective_date,(normalized->>'admissionCohortId')::uuid,(normalized->>'currentCohortId')::uuid,'Current cohort supplied during controlled onboarding');
      end if;

      insert into public.student_lifecycle_events(student_id,event_type,effective_date,to_cohort_id,reason)
      values(created_student_id,'admission',coalesce(admission_date_value,current_date),(normalized->>'admissionCohortId')::uuid,'Student admitted to programme');

      event_type_value := case normalized->>'lifecycleStatus'
        when 'deferred' then 'deferral'::public.student_lifecycle_event_type
        when 'on_leave' then 'leave_started'::public.student_lifecycle_event_type
        when 'completed' then 'programme_completion'::public.student_lifecycle_event_type
        when 'withdrawn' then 'withdrawal'::public.student_lifecycle_event_type
        when 'discontinued' then 'discontinuation'::public.student_lifecycle_event_type
        when 'graduated' then 'graduation'::public.student_lifecycle_event_type
        else null end;
      if event_type_value is not null then
        insert into public.student_lifecycle_events(student_id,event_type,effective_date,reason)
        values(created_student_id,event_type_value,status_effective_date,nullif(normalized->>'statusReason',''));
      end if;

      update public.import_rows set status='imported', imported_record_id=created_student_id, imported_at=now(), updated_at=now() where id=staged.id;
      imported := imported + 1;
    exception when others then
      update public.import_rows set status='failed', row_errors=coalesce(row_errors,'[]'::jsonb) || jsonb_build_array(sqlerrm), updated_at=now() where id=staged.id;
      failed := failed + 1;
    end;
  end loop;

  update public.import_batches set
    status = case when failed > 0 then 'completed_with_errors'::public.import_batch_status else 'completed'::public.import_batch_status end,
    imported_rows=imported, skipped_rows=skipped, failed_rows=failed, completed_at=now(), updated_at=now()
  where id=target_batch_id;

  return query select target_batch_id, imported, skipped, failed;
end;
$$;

grant execute on function public.import_valid_student_rows(uuid) to authenticated;
comment on function public.import_valid_student_rows(uuid) is 'Imports only validated student staging rows and creates authoritative student identity plus admission/current cohort and lifecycle history atomically.';
