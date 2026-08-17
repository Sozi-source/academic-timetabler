import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  AssessmentCandidateRow,
  AssessmentEventRow,
  AssessmentOverview,
  AssessmentSetupOptions,
} from './types';

const assessmentSelection = `
  id,
  title,
  assessment_type,
  assessment_date,
  max_mark,
  pass_mark,
  status,
  attendance_finalized_at,
  cat_marks_finalized_at,
  exam_marks_finalized_at,
  academic_period:academic_periods(id, code, name),
  unit:units(id, code, name),
  cohort:cohorts(id, code, name)
`;

export const getAssessments = cache(async (): Promise<AssessmentEventRow[]> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessment_events')
    .select(assessmentSelection)
    .eq('department_id', profile.activeDepartmentId)
    .eq('title', 'Unit Markbook')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Unable to load assessments: ${error.message}`);

  const rows = (data ?? []) as unknown as Omit<AssessmentEventRow, 'population'>[];
  if (rows.length === 0) return [];

  const { data: populationRows, error: populationError } = await supabase
    .from('assessment_population')
    .select('assessment_event_id')
    .in('assessment_event_id', rows.map((row) => row.id));

  if (populationError) throw new Error(`Unable to load assessment population totals: ${populationError.message}`);

  const counts = new Map<string, number>();
  for (const row of populationRows ?? []) {
    counts.set(row.assessment_event_id, (counts.get(row.assessment_event_id) ?? 0) + 1);
  }

  return rows.map((row) => ({ ...row, population: [{ count: counts.get(row.id) ?? 0 }] }));
});

export const getAssessmentById = cache(async (assessmentId: string): Promise<AssessmentEventRow | null> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessment_events')
    .select(assessmentSelection)
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .eq('title', 'Unit Markbook')
    .maybeSingle();

  if (error) throw new Error(`Unable to load assessment: ${error.message}`);
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from('assessment_population')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_event_id', assessmentId);

  if (countError) throw new Error(`Unable to load assessment population total: ${countError.message}`);

  return { ...(data as unknown as Omit<AssessmentEventRow, 'population'>), population: [{ count: count ?? 0 }] };
});

export const getAssessmentSetupOptions = cache(async (): Promise<AssessmentSetupOptions> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { periods: [], units: [], cohorts: [] };

  const supabase = await createClient();
  const [periodResult, unitResult, cohortResult] = await Promise.all([
    supabase
      .from('academic_periods')
      .select('id,code,name,status')
      .in('status', ['active', 'planned'])
      .order('starts_on', { ascending: false }),
    supabase
      .from('units')
      .select('id,code,name,programme:programmes!inner(id,code,department_id)')
      .eq('programmes.department_id', profile.activeDepartmentId)
      .eq('is_active', true)
      .order('code', { ascending: true }),
    supabase
      .from('cohorts')
      .select('id,code,name,programme:programmes!inner(id,department_id)')
      .eq('programmes.department_id', profile.activeDepartmentId)
      .in('status', ['planned', 'active'])
      .order('intake_date', { ascending: false }),
  ]);

  if (periodResult.error) throw new Error(`Unable to load academic periods: ${periodResult.error.message}`);
  if (unitResult.error) throw new Error(`Unable to load units: ${unitResult.error.message}`);
  if (cohortResult.error) throw new Error(`Unable to load cohorts: ${cohortResult.error.message}`);

  return {
    periods: (periodResult.data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status })),
    units: (unitResult.data ?? []).map((row) => {
      const programme = Array.isArray(row.programme) ? row.programme[0] : row.programme;
      return { id: row.id, code: row.code, name: row.name, programmeCode: programme?.code ?? '' };
    }),
    cohorts: (cohortResult.data ?? []).map((row) => {
      const programme = Array.isArray(row.programme) ? row.programme[0] : row.programme;
      return { id: row.id, code: row.code, name: row.name, programmeId: programme?.id ?? '' };
    }),
  };
});

export const getAssessmentOverview = cache(async (): Promise<AssessmentOverview> => {
  const assessments = await getAssessments();
  return {
    total: assessments.length,
    cats: assessments.filter((row) => Boolean(row.cat_marks_finalized_at)).length,
    exams: assessments.filter((row) => Boolean(row.exam_marks_finalized_at)).length,
    draft: assessments.filter((row) => row.status === 'draft').length,
    open: assessments.filter((row) => row.status === 'open').length,
    candidates: assessments.reduce((sum, row) => sum + (row.population?.[0]?.count ?? 0), 0),
  };
});

export const getAssessmentPopulation = cache(async (assessmentId: string): Promise<AssessmentCandidateRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessment_population')
    .select(`
      id,
      population_status,
      attendance_status,
      cat_absence_reason,
      cat_absence_recommendation,
      exam_absence_reason,
      exam_absence_recommendation,
      student:students(id, admission_number, full_name),
      cohort:cohorts(id, code, name)
    `)
    .eq('assessment_event_id', assessmentId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Unable to load assessment population: ${error.message}`);
  return (data ?? []) as unknown as AssessmentCandidateRow[];
});
