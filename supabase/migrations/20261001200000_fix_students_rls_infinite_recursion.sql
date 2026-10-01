-- ============================================================================
-- Migration: Fix Infinite Recursion in RLS Policy for Relation "students"
--
-- Root Cause:
--   In migration 20261001050000, policy `students_trainer_read` on `students`
--   queried `student_unit_registrations`, while policy
--   `student_unit_registrations_trainer_read` on `student_unit_registrations`
--   queried `students`.
--   PostgreSQL detected this cyclic dependency during query planning and threw:
--   "ERROR: infinite recursion detected in policy for relation 'students'".
--
-- Fix:
--   Drop and recreate `students_trainer_read` without referencing
--   `student_unit_registrations`. Trainers read students through department
--   access or through cohort allocation bindings (which join `teaching_allocations`
--   and `trainers` without touching `student_unit_registrations`).
-- ============================================================================

drop policy if exists students_trainer_read on public.students;

create policy students_trainer_read
on public.students for select to authenticated
using (
  -- 1. Department member / admin access (standard rule)
  public.current_user_can_access_department(department_id)
  -- 2. OR trainer teaching this student's cohort
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
);
