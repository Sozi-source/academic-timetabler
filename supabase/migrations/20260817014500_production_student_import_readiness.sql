-- ============================================================
-- Production student import readiness
-- - dropped-out lifecycle handling
-- - clean KCSE/National ID storage
-- - student self-verification history
-- - v1.2 controlled student import RPC
-- ============================================================

alter table public.students
  add column if not exists kcse_index_number text,
  add column if not exists national_id_number text,
  add column if not exists phone_number text,
  add column if not exists email text,
  add column if not exists details_verified_at timestamptz;

alter table public.students
  drop constraint if exists students_kcse_index_format_check,
  add constraint students_kcse_index_format_check
    check (
      kcse_index_number is null
      or trim(kcse_index_number) = ''
      or trim(kcse_index_number) ~ '^([0-9]{8}/[0-9]{3}|[0-9]{11})$'
    ),
  drop constraint if exists students_national_id_format_check,
  add constraint students_national_id_format_check
    check (
      national_id_number is null
      or trim(national_id_number) = ''
      or trim(national_id_number) ~ '^[0-9]{7,8}$'
    ),
  drop constraint if exists students_phone_length_check,
  add constraint students_phone_length_check
    check (phone_number is null or char_length(trim(phone_number)) between 7 and 30),
  drop constraint if exists students_email_length_check,
  add constraint students_email_length_check
    check (email is null or char_length(trim(email)) between 5 and 254);

create index if not exists students_kcse_index_lookup_idx
  on public.students (lower(trim(kcse_index_number)))
  where kcse_index_number is not null and trim(kcse_index_number) <> '';
create index if not exists students_national_id_lookup_idx
  on public.students (trim(national_id_number))
  where national_id_number is not null and trim(national_id_number) <> '';

create table if not exists public.student_profile_verifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  full_name text not null,
  kcse_index_number text,
  national_id_number text,
  phone_number text,
  email text,
  verified_at timestamptz not null default now(),
  verification_source text not null default 'student_portal',
  constraint student_profile_verification_source_check
    check (verification_source in ('student_portal','department'))
);

create index if not exists student_profile_verifications_student_idx
  on public.student_profile_verifications(student_id, verified_at desc);

alter table public.student_profile_verifications enable row level security;

drop policy if exists student_profile_verifications_department_select on public.student_profile_verifications;
create policy student_profile_verifications_department_select
on public.student_profile_verifications
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_profile_verifications.student_id
      and public.current_user_can_manage_department(s.department_id)
  )
);

create or replace function public.sync_student_academic_phase()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lifecycle_status = 'deferred' then new.academic_phase := 'deferred';
  elsif new.lifecycle_status = 'dropped_out' then new.academic_phase := 'dropped_out';
  elsif new.lifecycle_status = 'completed' then new.academic_phase := 'awaiting_graduation';
  elsif new.lifecycle_status = 'graduated' then new.academic_phase := 'graduated';
  elsif new.lifecycle_status in ('active','admitted') and new.academic_phase in ('deferred','dropped_out','awaiting_graduation','graduated') then new.academic_phase := 'in_class';
  end if;
  return new;
end; $$;

create or replace function public.import_valid_student_rows(target_batch_id uuid)
returns table(batch_id uuid, imported_count integer, skipped_count integer, failed_count integer)
language plpgsql security invoker set search_path = '' as $$
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
  lifecycle_value public.student_lifecycle_status;
  phase_value public.student_academic_phase;
  event_type_value public.student_lifecycle_event_type;
  normalized_kcse text;
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

  update public.import_batches
  set status='importing', started_at=coalesce(started_at,now()), updated_at=now()
  where id=target_batch_id;

  for staged in
    select * from public.import_rows where import_batch_id=target_batch_id order by source_row_number
  loop
    if staged.status <> 'valid' then
      update public.import_rows set status='skipped',updated_at=now() where id=staged.id;
      skipped:=skipped+1;
      continue;
    end if;

    begin
      normalized:=staged.normalized_data;
      admission_date_value:=nullif(normalized->>'admissionDate','')::date;
      current_effective_date:=nullif(normalized->>'currentCohortEffectiveDate','')::date;
      status_effective_date:=nullif(normalized->>'statusEffectiveDate','')::date;
      lifecycle_value:=(normalized->>'lifecycleStatus')::public.student_lifecycle_status;

      if lifecycle_value::text not in ('active','deferred','dropped_out','completed','graduated') then
        raise exception 'Unsupported departmental lifecycle status';
      end if;

      phase_value:=(normalized->>'academicPhase')::public.student_academic_phase;
      normalized_kcse := nullif(regexp_replace(coalesce(normalized->>'kcseIndexNumber',''), '\\s+', '', 'g'), '');
      if normalized_kcse ~ '^[0-9]{11}$' then
        normalized_kcse := substr(normalized_kcse,1,8) || '/' || substr(normalized_kcse,9,3);
      end if;

      insert into public.students(
        department_id,programme_id,admission_cohort_id,current_cohort_id,
        admission_number,full_name,lifecycle_status,academic_phase,
        admission_date,projected_completion_date,completion_date,graduation_date,
        kcse_index_number,national_id_number,
        admission_number_inference,notes
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
        nullif(normalized->>'projectedCompletionDate','')::date,
        case when lifecycle_value in ('completed','graduated') then status_effective_date else null end,
        case when lifecycle_value='graduated' then status_effective_date else null end,
        normalized_kcse,
        nullif(regexp_replace(coalesce(normalized->>'nationalIdNumber',''), '\\s+', '', 'g'), ''),
        coalesce(normalized->'inference','{}'::jsonb),
        nullif(normalized->>'notes','')
      ) returning id into created_student_id;

      if normalized->>'currentCohortId'=normalized->>'admissionCohortId' then
        insert into public.student_cohort_assignments(
          student_id,cohort_id,effective_from,is_admission_cohort,assignment_reason,notes
        ) values (
          created_student_id,(normalized->>'admissionCohortId')::uuid,
          coalesce(admission_date_value,current_date),true,'Admission cohort','Created during controlled student onboarding'
        );
      else
        insert into public.student_cohort_assignments(
          student_id,cohort_id,effective_from,effective_to,is_admission_cohort,assignment_reason,notes
        ) values (
          created_student_id,(normalized->>'admissionCohortId')::uuid,
          coalesce(admission_date_value,current_effective_date),current_effective_date-1,true,
          'Admission cohort','Historical admission cohort created during onboarding'
        );
        insert into public.student_cohort_assignments(
          student_id,cohort_id,effective_from,is_admission_cohort,assignment_reason,notes
        ) values (
          created_student_id,(normalized->>'currentCohortId')::uuid,current_effective_date,false,
          'Current study cohort at onboarding',nullif(normalized->>'statusReason','')
        );
        insert into public.student_lifecycle_events(
          student_id,event_type,effective_date,from_cohort_id,to_cohort_id,reason
        ) values (
          created_student_id,'cohort_change',current_effective_date,
          (normalized->>'admissionCohortId')::uuid,(normalized->>'currentCohortId')::uuid,
          'Current cohort supplied during controlled onboarding'
        );
      end if;

      insert into public.student_lifecycle_events(student_id,event_type,effective_date,to_cohort_id,reason)
      values(
        created_student_id,'admission',coalesce(admission_date_value,current_date),
        (normalized->>'admissionCohortId')::uuid,'Student admitted to programme'
      );

      event_type_value := case lifecycle_value
        when 'deferred' then 'deferral'::public.student_lifecycle_event_type
        when 'dropped_out' then 'dropout'::public.student_lifecycle_event_type
        when 'completed' then 'programme_completion'::public.student_lifecycle_event_type
        when 'graduated' then 'graduation'::public.student_lifecycle_event_type
        else null
      end;

      -- Historical source files do not always contain an exact status date.
      -- Preserve the status without inventing a date. Add the event only when a date is supplied.
      if event_type_value is not null and status_effective_date is not null then
        insert into public.student_lifecycle_events(student_id,event_type,effective_date,reason)
        values(created_student_id,event_type_value,status_effective_date,nullif(normalized->>'statusReason',''));
      end if;

      update public.import_rows
      set status='imported', imported_record_id=created_student_id, imported_at=now(), updated_at=now()
      where id=staged.id;
      imported:=imported+1;
    exception when others then
      update public.import_rows
      set status='failed',row_errors=coalesce(row_errors,'[]'::jsonb)||jsonb_build_array(sqlerrm),updated_at=now()
      where id=staged.id;
      failed:=failed+1;
    end;
  end loop;

  update public.import_batches
  set status=case when failed>0 then 'completed_with_errors'::public.import_batch_status else 'completed'::public.import_batch_status end,
      imported_rows=imported,skipped_rows=skipped,failed_rows=failed,completed_at=now(),updated_at=now()
  where id=target_batch_id;

  return query select target_batch_id,imported,skipped,failed;
end; $$;

grant execute on function public.import_valid_student_rows(uuid) to authenticated;
