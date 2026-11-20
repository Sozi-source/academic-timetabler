-- ============================================================================
-- Migration: Harden Trainer Visibility & Roster Sync for Individual Class Assignments
--
-- Root Causes Addressed:
--   1. Cross-department trainers teaching a class with individually assigned
--      transfer students (via `student_class_assignments`) could not read those
--      students in `students`, `student_class_assignments`, or
--      `student_unit_registrations` due to department-only / same-unit-only RLS.
--   2. Active `student_class_assignments` did not automatically add the student
--      to `assessment_roster` for the target allocation's open markbook(s),
--      leaving transfer students missing from trainer marksheets.
--
-- Fixes:
--   1. SECURITY DEFINER helper `trainer_has_class_assignment_for_student(uuid)`
--      (avoids any RLS recursion on `students`).
--   2. Update `students_trainer_read`, `student_class_assignments_read`, and
--      `student_unit_registrations_trainer_read` RLS policies to include
--      trainers on active `student_class_assignments.teaching_allocation_id`.
--   3. Add an automated trigger on `student_class_assignments` to ensure
--      assigned active in-class students are added to open `assessment_roster`
--      records for the target allocation's unit & academic period.
--   4. Idempotent backfill for all existing active `student_class_assignments`.
-- ============================================================================

-- 1. Recursion-safe helper for students RLS
create or replace function public.trainer_has_class_assignment_for_student(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.student_class_assignments sca
    join public.teaching_allocations ta
      on ta.id = sca.teaching_allocation_id
    join public.trainers t
      on t.id = ta.trainer_id
    where sca.student_id = target_student_id
      and sca.is_active = true
      and t.profile_id = auth.uid()
      and ta.status in ('draft', 'active', 'completed')
  );
$$;

revoke all on function public.trainer_has_class_assignment_for_student(uuid) from public, anon;
grant execute on function public.trainer_has_class_assignment_for_student(uuid) to authenticated;

-- 2. Allow trainers to read students assigned to their teaching allocations
drop policy if exists students_trainer_read on public.students;

create policy students_trainer_read
on public.students for select to authenticated
using (
  public.current_user_can_access_department(department_id)
  or exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    where t.profile_id = auth.uid()
      and ta.status in ('draft', 'active', 'completed')
      and (
        public.students.current_cohort_id = ta.cohort_id
        or public.students.current_cohort_id = any(ta.participant_cohort_ids)
      )
  )
  or public.trainer_has_class_assignment_for_student(public.students.id)
);

-- 3. Allow trainers to read student_class_assignments for their own allocations
drop policy if exists student_class_assignments_read on public.student_class_assignments;

create policy student_class_assignments_read
on public.student_class_assignments for select to authenticated
using (
  exists (
    select 1
    from public.students student
    join public.programmes programme on programme.id = student.programme_id
    where student.id = public.student_class_assignments.student_id
      and public.current_user_can_access_department(programme.department_id)
  )
  or exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    where ta.id = public.student_class_assignments.teaching_allocation_id
      and t.profile_id = auth.uid()
      and ta.status in ('draft', 'active', 'completed')
  )
);

-- 4. Allow trainers to read source unit registrations linked via active class assignments
drop policy if exists student_unit_registrations_trainer_read on public.student_unit_registrations;

create policy student_unit_registrations_trainer_read
on public.student_unit_registrations for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = public.student_unit_registrations.student_id
      and public.current_user_can_access_department(s.department_id)
  )
  or exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    where t.profile_id = auth.uid()
      and ta.unit_id = public.student_unit_registrations.unit_id
      and ta.academic_period_id = public.student_unit_registrations.academic_period_id
      and ta.status in ('draft', 'active', 'completed')
  )
  or exists (
    select 1
    from public.student_class_assignments sca
    join public.teaching_allocations ta on ta.id = sca.teaching_allocation_id
    join public.trainers t on t.id = ta.trainer_id
    where sca.source_registration_id = public.student_unit_registrations.id
      and sca.is_active = true
      and t.profile_id = auth.uid()
      and ta.status in ('draft', 'active', 'completed')
  )
);

-- 5. Automatically sync active individual class assignments into open assessment_roster records
create or replace function public.sync_student_class_assignment_to_assessment_roster()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_active is not true then
    return new;
  end if;

  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    pre_assessment_status
  )
  select
    ae.id,
    new.student_id,
    coalesce(s.current_cohort_id, s.admission_cohort_id, ta.cohort_id),
    ae.academic_period_id,
    ae.unit_id,
    'expected'
  from public.teaching_allocations ta
  join public.assessment_events ae
    on ae.unit_id = ta.unit_id
   and ae.academic_period_id = ta.academic_period_id
   and ae.status <> 'closed'
   and ae.exam_marks_finalized_at is null
  join public.students s
    on s.id = new.student_id
  where ta.id = new.teaching_allocation_id
    and s.lifecycle_status in ('admitted', 'active')
    and coalesce(s.academic_phase, 'in_class') = 'in_class'
  on conflict (assessment_id, student_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trigger_sync_student_class_assignment_roster on public.student_class_assignments;

create trigger trigger_sync_student_class_assignment_roster
after insert or update of is_active, teaching_allocation_id on public.student_class_assignments
for each row
execute function public.sync_student_class_assignment_to_assessment_roster();

-- 6. Idempotent backfill for all existing active individual class assignments
insert into public.assessment_roster (
  assessment_id,
  student_id,
  cohort_id,
  academic_period_id,
  unit_id,
  pre_assessment_status
)
select
  ae.id,
  sca.student_id,
  coalesce(s.current_cohort_id, s.admission_cohort_id, ta.cohort_id),
  ae.academic_period_id,
  ae.unit_id,
  'expected'
from public.student_class_assignments sca
join public.teaching_allocations ta
  on ta.id = sca.teaching_allocation_id
 and ta.status in ('draft', 'active', 'completed')
join public.assessment_events ae
  on ae.unit_id = ta.unit_id
 and ae.academic_period_id = ta.academic_period_id
 and ae.status <> 'closed'
 and ae.exam_marks_finalized_at is null
join public.students s
  on s.id = sca.student_id
where sca.is_active = true
  and s.lifecycle_status in ('admitted', 'active')
  and coalesce(s.academic_phase, 'in_class') = 'in_class'
on conflict (assessment_id, student_id) do nothing;
