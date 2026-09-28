import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

import type { WorkbookAssessmentContext, WorkbookPopulationStudent } from './workbook';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type EventRow = {
  id: string;
  title: string;
  assessment_type: 'cat' | 'exam';
  assessment_date: string | null;
  max_mark: number;
  pass_mark: number;
  attendance_finalized_at: string | null;
  cat_marks_finalized_at: string | null;
  exam_marks_finalized_at: string | null;
  academic_period: Relation<{ id: string; name: string; starts_on: string }>;
  unit: Relation<{ id: string; code: string; name: string; programme: Relation<{ code: string; name: string }> }>;
};

type PopulationRow = {
  attendance_status: 'pending' | 'present' | 'absent';
  student: Relation<{ id: string; admission_number: string; full_name: string }>;
  cohort: Relation<{ id: string; code: string; name: string }>;
};

type ResultRow = {
  student_id: string;
  component_marks: Record<string, unknown> | null;
};

type AllocationRow = {
  cohort_id: string;
  participant_cohort_ids: string[] | null;
  trainer: Relation<{ full_name: string }>;
};

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}


export async function refreshUnitMarkbookPopulation(assessmentId: string) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { ok: false, message: 'No active department selected.' };

  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from('assessment_events')
    .select('id,department_id,status')
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();

  if (eventError) {
    return { ok: false, message: `Unable to validate unit markbook: ${eventError.message}` };
  }
  if (!event) return { ok: false, message: 'Unit markbook not found.' };

  const { error } = await admin.rpc('refresh_assessment_population', {
    target_assessment_event_id: assessmentId,
  });

  if (error) {
    return { ok: false, message: `Unable to rebuild unit population: ${error.message}` };
  }

  const { count, error: countError } = await admin
    .from('assessment_population')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_event_id', assessmentId)
    .eq('population_status', 'expected');

  if (countError) {
    return { ok: false, message: `Unable to verify rebuilt population: ${countError.message}` };
  }

  if ((count ?? 0) === 0) {
    return {
      ok: false,
      message:
        'No verified students are registered for this unit in the active academic period. Verify unit registrations before generating the workbook.',
    };
  }

  return { ok: true, count: count ?? 0 };
}

export async function getAssessmentWorkbookData(assessmentId: string) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from('assessment_events')
    .select(`
      id,title,assessment_type,assessment_date,max_mark,pass_mark,attendance_finalized_at,cat_marks_finalized_at,exam_marks_finalized_at,
      academic_period:academic_periods(id,name,starts_on),
      unit:units(id,code,name,programme:programmes(code,name))
    `)
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load assessment workbook data: ${error.message}`);
  if (!event) return null;

  const row = event as unknown as EventRow;
  const period = one(row.academic_period);
  const unit = one(row.unit);
  const programme = one(unit?.programme ?? null);
  if (!period || !unit || !programme) return null;

  const [
    { data: population, error: populationError },
    { data: results, error: resultsError },
    { data: allocations, error: allocationError },
  ] = await Promise.all([
    admin
      .from('assessment_population')
      .select(`
        attendance_status,
        student:students(id,admission_number,full_name),
        cohort:cohorts(id,code,name)
      `)
      .eq('assessment_event_id', assessmentId)
      .eq('population_status', 'expected')
      .order('cohort_id')
      .order('created_at'),
    admin
      .from('assessment_results')
      .select('student_id,component_marks')
      .eq('assessment_event_id', assessmentId),
    admin
      .from('teaching_allocations')
      .select('cohort_id,participant_cohort_ids,trainer:trainers(full_name)')
      .eq('academic_period_id', period.id)
      .eq('unit_id', unit.id)
      .not('trainer_id', 'is', null)
      .in('status', ['draft', 'active']),
  ]);
  if (populationError) throw new Error(`Unable to load assessment population: ${populationError.message}`);
  if (resultsError) throw new Error(`Unable to load existing assessment marks: ${resultsError.message}`);
  if (allocationError) throw new Error(`Unable to load unit trainer: ${allocationError.message}`);

  const context: WorkbookAssessmentContext = {
    id: row.id,
    title: row.title,
    assessmentType: 'exam',
    maxMark: 100,
    passMark: 40,
    assessmentDate: row.assessment_date,
    departmentName: profile.departmentName,
    academicPeriodId: period.id,
    academicPeriodName: period.name,
    academicYear: Number(period.starts_on.slice(0, 4)),
    unitId: unit.id,
    unitCode: unit.code,
    unitName: unit.name,
    programmeCode: programme.code,
    programmeName: programme.name,
  };

  const resultMap = new Map<string, ResultRow>();
  for (const result of (results ?? []) as unknown as ResultRow[]) resultMap.set(result.student_id, result);

  const trainerNamesByCohort = new Map<string, Set<string>>();
  for (const item of (allocations ?? []) as unknown as AllocationRow[]) {
    const trainer = one(item.trainer);
    const name = trainer?.full_name?.trim();
    if (!name) continue;

    const cohortIds = new Set<string>([
      item.cohort_id,
      ...((item.participant_cohort_ids ?? []).filter(Boolean)),
    ]);

    for (const cohortId of cohortIds) {
      const names = trainerNamesByCohort.get(cohortId) ?? new Set<string>();
      names.add(name);
      trainerNamesByCohort.set(cohortId, names);
    }
  }

  const students: WorkbookPopulationStudent[] = (population ?? []).flatMap((item) => {
    const p = item as unknown as PopulationRow;
    const student = one(p.student);
    const cohort = one(p.cohort);
    if (!student || !cohort) return [];
    const marks = resultMap.get(student.id)?.component_marks ?? {};
    return [{
      studentId: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      cohortId: cohort.id,
      cohortCode: cohort.code,
      cohortName: cohort.name,
      attendanceStatus: p.attendance_status,
      trainerName: [...(trainerNamesByCohort.get(cohort.id) ?? new Set<string>())].join(' / ') || 'Unassigned',
      existingMarks: {
        assignment: numberOrNull(marks.assignment),
        presentation: numberOrNull(marks.presentation),
        rat: numberOrNull(marks.rat),
        cat1: numberOrNull(marks.cat1),
        exam: numberOrNull(marks.exam),
      },
    }];
  });

  return {
    context,
    students,
    attendanceFinalizedAt: row.attendance_finalized_at,
    catMarksFinalizedAt: row.cat_marks_finalized_at,
    examMarksFinalizedAt: row.exam_marks_finalized_at,
  };
}
