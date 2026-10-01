-- ============================================================================
-- Migration: Harden Trainer Attendance Access & Cross-Department RLS
--
-- Problems:
--   1. Trainers (e.g. Maureen Ayuma, Milkah Wambui, Elias Kirimi, Martin Wanjohi)
--      had active_department_id = NULL in their profile, causing
--      current_user_can_access_department() to evaluate to FALSE and returning
--      0 student records / blank attendance signing sheets.
--   2. Cross-department / service unit trainers (e.g. Jane Osoo from Applied Sciences
--      teaching Human Nutrition and Dietetics students in DHN 3202) were blocked
--      by Department RLS from reading students in another department, resulting in
--      blank attendance sheets.
--   3. Trainers require read access to students and unit registrations for the
--      units, cohorts, and allocations they are assigned to teach.
--
-- Fixes:
--   1. Backfill profiles.active_department_id from trainers.department_id.
--   2. Grant authenticated trainers read access to students enrolled in their
--      allocated cohorts or registered for their allocated units.
--   3. Grant authenticated trainers read access to student_unit_registrations
--      for units they are allocated to teach in the relevant academic period.
-- ============================================================================

-- 1. Repair NULL active_department_id for all trainers with a linked department
update public.profiles p
set
  active_department_id = t.department_id,
  updated_at = now()
from public.trainers t
where t.profile_id = p.id
  and p.active_department_id is null
  and t.department_id is not null;

-- 2. Policy: Trainers can read students enrolled in their allocated cohorts
--    or registered for their allocated units (across all departments).
drop policy if exists students_trainer_read on public.students;

create policy students_trainer_read
on public.students for select to authenticated
using (
  -- Department member/admin access (existing rule)
  public.current_user_can_access_department(department_id)
  -- OR trainer teaching this student's cohort
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
  -- OR trainer teaching a unit this student is registered for
  or exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    join public.student_unit_registrations sur
      on sur.unit_id = ta.unit_id
      and sur.academic_period_id = ta.academic_period_id
    where t.profile_id = auth.uid()
      and sur.student_id = public.students.id
      and ta.status in ('draft', 'active', 'completed')
  )
);

-- 3. Policy: Trainers can read unit registrations for their allocated units
drop policy if exists student_unit_registrations_trainer_read on public.student_unit_registrations;

create policy student_unit_registrations_trainer_read
on public.student_unit_registrations for select to authenticated
using (
  -- Department member/admin access (existing rule)
  exists (
    select 1 from public.students s
    where s.id = public.student_unit_registrations.student_id
      and public.current_user_can_access_department(s.department_id)
  )
  -- OR trainer allocated to this unit and period
  or exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    where t.profile_id = auth.uid()
      and ta.unit_id = public.student_unit_registrations.unit_id
      and ta.academic_period_id = public.student_unit_registrations.academic_period_id
      and ta.status in ('draft', 'active', 'completed')
  )
);

-- 4. Policy: Trainers can read cohort assignments for their allocated cohorts
drop policy if exists student_cohort_assignments_trainer_read on public.student_cohort_assignments;

create policy student_cohort_assignments_trainer_read
on public.student_cohort_assignments for select to authenticated
using (
  exists (
    select 1
    from public.teaching_allocations ta
    join public.trainers t on t.id = ta.trainer_id
    where t.profile_id = auth.uid()
      and ta.status in ('draft', 'active', 'completed')
      and (
        public.student_cohort_assignments.cohort_id = ta.cohort_id
        or public.student_cohort_assignments.cohort_id = any(ta.participant_cohort_ids)
      )
  )
);
