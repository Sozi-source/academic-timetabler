import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type {
  AssessmentCandidateRow,
  AssessmentEventRow,
  AssessmentOverview,
  AssessmentSetupOptions,
} from './types';

function relationRow(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : null;
}

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
  trainer_entry_open,
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

  const [
    { data: populationRows, error: populationError },
    { data: allocationRows, error: allocationError },
  ] = await Promise.all([
    supabase
      .from('assessment_population')
      .select('assessment_event_id')
      .in('assessment_event_id', rows.map((row) => row.id)),
    supabase
      .from('teaching_allocations')
      .select('unit_id,academic_period_id,cohort_id,participant_cohort_ids,trainer:trainers(id,full_name,email,phone_number,profile_id),cohort:cohorts(id,name,code)')
      .in('academic_period_id', [...new Set(rows.map((row) => row.academic_period?.id).filter((id): id is string => Boolean(id)))])
      .in('status', ['draft', 'active']),
  ]);

  if (populationError) throw new Error(`Unable to load assessment population totals: ${populationError.message}`);
  if (allocationError) throw new Error(`Unable to load assigned trainers: ${allocationError.message}`);

  const linkedProfileIds = [...new Set((allocationRows ?? [])
    .map((allocation) => relationRow(allocation.trainer)?.profile_id)
    .filter((id): id is string => typeof id === 'string'))];
  const admin = createAdminClient();
  const { data: linkedProfiles, error: profileError } = linkedProfileIds.length
    ? await admin.from('profiles').select('id,email,is_active').in('id', linkedProfileIds)
    : { data: [], error: null };
  if (profileError) throw new Error(`Unable to verify trainer accounts: ${profileError.message}`);
  const profileById = new Map((linkedProfiles ?? []).map((profile) => [profile.id, profile]));

  const cohortIds = [...new Set((allocationRows ?? []).flatMap((allocation) => [
    allocation.cohort_id,
    ...(allocation.participant_cohort_ids ?? []),
  ]).filter((id): id is string => Boolean(id)))];
  const { data: participantCohorts, error: cohortError } = cohortIds.length
    ? await supabase.from('cohorts').select('id,name,code').in('id', cohortIds)
    : { data: [], error: null };
  if (cohortError) throw new Error(`Unable to load allocated cohorts: ${cohortError.message}`);
  const cohortNameById = new Map((participantCohorts ?? []).map((cohort) => [cohort.id, cohort.code || cohort.name]));

  const counts = new Map<string, number>();
  for (const row of populationRows ?? []) {
    counts.set(row.assessment_event_id, (counts.get(row.assessment_event_id) ?? 0) + 1);
  }

  const allocationsByAssessment = new Map<string, Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    accountLinked: boolean;
    cohorts: string[];
  }>>();
  for (const allocation of allocationRows ?? []) {
    const trainer = relationRow(allocation.trainer);
    const cohort = relationRow(allocation.cohort);
    const trainerId = typeof trainer?.id === 'string' ? trainer.id : null;
    const trainerName = typeof trainer?.full_name === 'string' ? trainer.full_name : null;
    if (!trainerId || !trainerName) continue;
    const assessment = rows.find((row) => row.unit?.id === allocation.unit_id && row.academic_period?.id === allocation.academic_period_id);
    if (!assessment) continue;
    const assigned = allocationsByAssessment.get(assessment.id) ?? [];
    let trainerEntry = assigned.find((entry) => entry.id === trainerId);
    if (!trainerEntry) {
      const trainerProfileId = typeof trainer.profile_id === 'string' ? trainer.profile_id : null;
      const linkedProfile = trainerProfileId ? profileById.get(trainerProfileId) : null;
      trainerEntry = {
        id: trainerId,
        name: trainerName,
        email: linkedProfile?.email ?? (typeof trainer.email === 'string' ? trainer.email : null),
        phone: typeof trainer.phone_number === 'string' ? trainer.phone_number : null,
        accountLinked: Boolean(linkedProfile?.is_active),
        cohorts: [],
      };
      assigned.push(trainerEntry);
    }
    const assignedCohortIds = [allocation.cohort_id, ...(allocation.participant_cohort_ids ?? [])];
    const names = assignedCohortIds
      .map((cohortId) => cohortNameById.get(cohortId) ?? (cohortId === cohort?.id ? cohort.code || cohort.name : null))
      .filter((name): name is string => Boolean(name));
    for (const cohortName of names) {
      if (!trainerEntry.cohorts.includes(cohortName)) trainerEntry.cohorts.push(cohortName);
    }
    allocationsByAssessment.set(assessment.id, assigned);
  }

  return rows.map((row) => ({
    ...row,
    population: [{ count: counts.get(row.id) ?? 0 }],
    assigned_trainers: allocationsByAssessment.get(row.id) ?? [],
  }));
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
