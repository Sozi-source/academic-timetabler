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
  current_stage_id,
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
  current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name, current_academic_period_number)
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

  let query = supabase
    .from('students')
    .select(studentSelection)
    .order('full_name', { ascending: true });

  if (status) {
    query = query.eq('lifecycle_status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load students: ${error.message}`,
    );
  }

  const rows = (data ?? []) as unknown as Array<
    StudentRow & {
      current_stage_id?: string | null;
      current_stage_sequence_number?: number | null;
    }
  >;

  const stageIds = [
    ...new Set(
      rows
        .map((student) => student.current_stage_id)
        .filter(
          (value): value is string =>
            typeof value === 'string' &&
            value.length > 0,
        ),
    ),
  ];

  if (stageIds.length === 0) {
    return rows;
  }

  const { data: stageRows, error: stageError } =
    await supabase
      .from('programme_stages')
      .select('id, sequence_number')
      .in('id', stageIds);

  if (stageError) {
    throw new Error(
      `Unable to load student stages: ${stageError.message}`,
    );
  }

  const stageById = new Map(
    (stageRows ?? []).map((stage) => [
      stage.id,
      stage.sequence_number,
    ]),
  );

  return rows.map((student) => ({
    ...student,
    current_stage_sequence_number:
      student.current_stage_id
        ? stageById.get(student.current_stage_id) ??
          null
        : null,
  }));
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

export const getStudentActiveReportingStatus = cache(async (studentId: string): Promise<'pending' | 'reported' | 'deferred' | 'dropped_out'> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_period_reporting')
    .select('reporting_status, academic_periods!inner(status)')
    .eq('student_id', studentId)
    .eq('academic_periods.status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Unable to load student reporting status: ${error.message}`);
  return (data?.reporting_status as 'pending' | 'reported' | 'deferred' | 'dropped_out' | undefined) ?? 'pending';
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

export interface RegistryCohortOption {
  id: string;
  code: string;
  name: string;
  programmeId: string;
  programmeCode: string;
}

interface CohortWithProgrammeRow {
  id: string;
  code: string;
  name: string;
  programme_id: string;
  programme: { code: string } | null;
}

export const getRegistryCohortOptions = cache(async (): Promise<RegistryCohortOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, code, name, programme_id, programme:programmes!cohorts_programme_id_fkey(code)')
    .in('status', ['planned', 'active'])
    .order('name', { ascending: true });

  if (error) throw new Error(`Unable to load cohort options: ${error.message}`);

  const rows = (data ?? []) as unknown as CohortWithProgrammeRow[];
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    programmeId: row.programme_id,
    programmeCode: row.programme?.code ?? '',
  }));
});

