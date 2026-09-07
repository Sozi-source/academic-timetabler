-- ============================================================
-- Migration: 20260907052500_update_student_admission_number.sql
-- Description: Transactional correction of student admission numbers
--              with audit logging in student_lifecycle_events.
-- ============================================================

create or replace function public.update_student_admission_number(
  target_student_id uuid,
  new_admission_number text,
  correction_reason text default null,
  correction_notes text default null,
  new_inference jsonb default null,
  new_programme_id uuid default null,
  new_cohort_id uuid default null
)
returns table (
  id uuid,
  admission_number text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  clean_admission text;
  duplicate_student_id uuid;
  resolved_reason text;
  resolved_notes text;
  resolved_programme_id uuid;
  resolved_cohort_id uuid;
begin
  -- 1. Locate student and acquire row lock
  select * into selected_student
  from public.students
  where id = target_student_id
  for update;

  if selected_student.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  -- 2. Authorization check: department management privilege
  if not public.current_user_can_manage_department(selected_student.department_id) then
    raise exception using errcode = '42501', message = 'You cannot manage students in this department';
  end if;

  -- 3. Clean and normalize admission number (standard TVET formatting)
  clean_admission := upper(trim(regexp_replace(new_admission_number, '\s+', ' ', 'g')));
  if clean_admission is null or length(clean_admission) < 3 or length(clean_admission) > 80 then
    raise exception using errcode = '22023', message = 'Admission number must be between 3 and 80 characters';
  end if;

  -- 4. If unchanged and no programme/cohort changes, return current state safely
  if clean_admission = selected_student.admission_number 
     and (new_programme_id is null or new_programme_id = selected_student.programme_id)
     and (new_cohort_id is null or new_cohort_id = selected_student.admission_cohort_id) then
    return query select selected_student.id, selected_student.admission_number;
    return;
  end if;

  -- 5. Enforce uniqueness within the student's department
  select s.id into duplicate_student_id
  from public.students s
  where s.department_id = selected_student.department_id
    and lower(trim(s.admission_number)) = lower(clean_admission)
    and s.id <> selected_student.id
  limit 1;

  if duplicate_student_id is not null then
    raise exception using errcode = '23505', message = 'Admission number already exists in this department';
  end if;

  -- 6. Update the student record (with programme and cohort synchronization if provided)
  resolved_programme_id := coalesce(new_programme_id, selected_student.programme_id);
  resolved_cohort_id := coalesce(new_cohort_id, selected_student.admission_cohort_id);

  update public.students
  set admission_number = clean_admission,
      admission_number_inference = coalesce(new_inference, admission_number_inference),
      programme_id = resolved_programme_id,
      admission_cohort_id = resolved_cohort_id,
      current_cohort_id = coalesce(new_cohort_id, selected_student.current_cohort_id),
      updated_at = now(),
      updated_by = auth.uid()
  where id = selected_student.id;

  -- Update active cohort assignments if cohort changed
  if new_cohort_id is not null and new_cohort_id <> selected_student.admission_cohort_id then
    update public.student_cohort_assignments
    set cohort_id = new_cohort_id,
        assignment_reason = 'Updated with admission number correction'
    where student_id = selected_student.id
      and effective_to is null;
  end if;

  -- 7. Record an administrative correction in student lifecycle events
  resolved_reason := coalesce(
    nullif(trim(correction_reason), ''),
    'Admission number corrected from ' || selected_student.admission_number || ' to ' || clean_admission
  );

  resolved_notes := coalesce(
    nullif(trim(correction_notes), ''),
    'Admission number changed from "' || selected_student.admission_number || '" to "' || clean_admission || '".'
  );

  insert into public.student_lifecycle_events (
    student_id,
    event_type,
    effective_date,
    reason,
    notes,
    created_by,
    created_at
  )
  values (
    selected_student.id,
    'administrative_correction'::public.student_lifecycle_event_type,
    current_date,
    resolved_reason,
    resolved_notes,
    auth.uid(),
    now()
  );

  return query select selected_student.id, clean_admission;
end;
$$;

grant execute on function public.update_student_admission_number(uuid, text, text, text, jsonb, uuid, uuid) to authenticated;
