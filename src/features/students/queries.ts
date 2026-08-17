import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  StudentCohortOption,
  StudentDetail,
  StudentLifecycleEvent,
  StudentRow,
  StudentSummary,
} from './types';

const studentSelection = `
  id,
  admission_number,
  full_name,
  lifecycle_status,
  academic_phase,
  completion_date,
  graduation_date,
  admission_date,
  projected_completion_date,
  kcse_index_number,
  national_id_number,
  phone_number,
  email,
  details_verified_at,
  programme:programmes!students_programme_id_fkey(id, code, name),
  admission_cohort:cohorts!students_admission_cohort_id_fkey(id, code, name),
  current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name)
`;

export const getStudentSummary = cache(async (): Promise<StudentSummary> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('students').select('lifecycle_status,academic_phase');

  if (error) throw new Error(`Unable to load student summary: ${error.message}`);
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((row) => row.lifecycle_status === 'active' || row.lifecycle_status === 'admitted').length,
    deferred: rows.filter((row) => row.lifecycle_status === 'deferred').length,
    droppedOut: rows.filter((row) => row.lifecycle_status === 'dropped_out').length,
    completed: rows.filter((row) => row.lifecycle_status === 'completed').length,
    graduated: rows.filter((row) => row.lifecycle_status === 'graduated').length,
    attachment: rows.filter((row) => row.lifecycle_status === 'active' && row.academic_phase === 'attachment').length,
  };
});

export const getStudents = cache(async (
  status?: 'active' | 'deferred' | 'dropped_out' | 'completed' | 'graduated',
): Promise<StudentRow[]> => {
  const supabase = await createClient();
  let query = supabase.from('students').select(studentSelection).order('full_name', { ascending: true });
  if (status) query = query.eq('lifecycle_status', status);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load students: ${error.message}`);
  return (data ?? []) as unknown as StudentRow[];
});

export const getStudentById = cache(async (studentId: string): Promise<StudentDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      department_id,
      programme_id,
      admission_cohort_id,
      current_cohort_id,
      admission_number,
      full_name,
      lifecycle_status,
      academic_phase,
      completion_date,
      graduation_date,
      admission_date,
      projected_completion_date,
      kcse_index_number,
      national_id_number,
      phone_number,
      email,
      details_verified_at,
      notes,
      programme:programmes!students_programme_id_fkey(id, code, name),
      admission_cohort:cohorts!students_admission_cohort_id_fkey(id, code, name),
      current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name)
    `)
    .eq('id', studentId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load student: ${error.message}`);
  return data ? (data as unknown as StudentDetail) : null;
});

export const getStudentLifecycleEvents = cache(async (studentId: string): Promise<StudentLifecycleEvent[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_lifecycle_events')
    .select(`
      id,
      event_type,
      effective_date,
      expected_resume_date,
      reason,
      notes,
      created_at,
      from_cohort:cohorts!student_lifecycle_events_from_cohort_id_fkey(id, code, name),
      to_cohort:cohorts!student_lifecycle_events_to_cohort_id_fkey(id, code, name)
    `)
    .eq('student_id', studentId)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Unable to load student timeline: ${error.message}`);
  return (data ?? []) as unknown as StudentLifecycleEvent[];
});

export const getProgressionStudents = cache(async (): Promise<StudentRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .select(studentSelection)
    .in('lifecycle_status', ['deferred', 'dropped_out', 'completed', 'graduated'])
    .order('lifecycle_status', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) throw new Error(`Unable to load progression students: ${error.message}`);
  return (data ?? []) as unknown as StudentRow[];
});

export const getStudentCohortOptions = cache(async (programmeId: string): Promise<StudentCohortOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, code, name, intake_date, expected_completion_date')
    .eq('programme_id', programmeId)
    .in('status', ['planned', 'active'])
    .order('intake_date', { ascending: false });

  if (error) throw new Error(`Unable to load cohort options: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    intakeDate: row.intake_date,
    expectedCompletionDate: row.expected_completion_date,
  }));
});
