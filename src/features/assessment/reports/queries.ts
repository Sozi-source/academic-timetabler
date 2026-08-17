import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function num(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export interface ReportStudentRow {
  eventId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  trainerName: string;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortName: string;
  attendance: 'pending' | 'present' | 'absent';
  catReason: string;
  catRecommendation: string;
  examReason: string;
  examRecommendation: string;
  assignment: number | null;
  presentation: number | null;
  rat: number | null;
  cat1: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}

export interface AssessmentPeriodReportData {
  periodId: string;
  periodName: string;
  departmentName: string;
  rows: ReportStudentRow[];
}

export async function getActiveAssessmentPeriodReportData(): Promise<AssessmentPeriodReportData | null> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const admin = createAdminClient();
  const { data: period, error: periodError } = await admin
    .from('academic_periods')
    .select('id,name')
    .eq('status', 'active')
    .order('starts_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error(`Unable to load active academic period: ${periodError.message}`);
  if (!period) return null;

  const { data: events, error: eventsError } = await admin
    .from('assessment_events')
    .select('id,unit_id,unit:units(id,code,name)')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', period.id)
    .eq('title', 'Unit Markbook');
  if (eventsError) throw new Error(`Unable to load unit markbooks: ${eventsError.message}`);
  if (!events?.length) return { periodId: period.id, periodName: period.name, departmentName: profile.departmentName, rows: [] };

  const eventIds = events.map((event) => event.id);
  const unitIds = [...new Set(events.map((event) => event.unit_id))];
  const [{ data: populations, error: populationError }, { data: results, error: resultsError }, { data: allocations, error: allocationError }] = await Promise.all([
    admin.from('assessment_population').select(`
      assessment_event_id,student_id,cohort_id,attendance_status,
      cat_absence_reason,cat_absence_recommendation,exam_absence_reason,exam_absence_recommendation,
      student:students(id,admission_number,full_name),cohort:cohorts(id,code,name)
    `).in('assessment_event_id', eventIds).eq('population_status', 'expected'),
    admin.from('assessment_results').select('assessment_event_id,student_id,component_marks,total_mark,grade').in('assessment_event_id', eventIds),
    admin.from('teaching_allocations').select('unit_id,cohort_id,participant_cohort_ids,trainer:trainers(full_name)').eq('academic_period_id', period.id).in('unit_id', unitIds).in('status', ['draft','active']),
  ]);
  if (populationError) throw new Error(`Unable to load assessment populations: ${populationError.message}`);
  if (resultsError) throw new Error(`Unable to load assessment results: ${resultsError.message}`);
  if (allocationError) throw new Error(`Unable to load trainers: ${allocationError.message}`);

  const eventMap = new Map(events.map((event) => {
    const unit = one(event.unit as Relation<{ id: string; code: string; name: string }>);
    return [event.id, { unitId: event.unit_id, unitCode: unit?.code ?? '', unitName: unit?.name ?? '' }];
  }));
  const resultMap = new Map((results ?? []).map((result) => [`${result.assessment_event_id}:${result.student_id}`, result]));
  const trainerMap = new Map<string, string>();
  for (const allocation of allocations ?? []) {
    const trainer = one(allocation.trainer as Relation<{ full_name: string }>);
    const cohortIds = new Set<string>([allocation.cohort_id, ...((allocation.participant_cohort_ids as string[] | null) ?? [])].filter(Boolean));
    for (const cohortId of cohortIds) trainerMap.set(`${allocation.unit_id}:${cohortId}`, trainer?.full_name ?? '');
  }

  const rows: ReportStudentRow[] = [];
  for (const population of populations ?? []) {
    const student = one(population.student as Relation<{ id: string; admission_number: string; full_name: string }>);
    const cohort = one(population.cohort as Relation<{ id: string; code: string; name: string }>);
    const event = eventMap.get(population.assessment_event_id);
    if (!student || !cohort || !event) continue;
    const result = resultMap.get(`${population.assessment_event_id}:${student.id}`);
    const marks = (result?.component_marks ?? {}) as Record<string, unknown>;
    rows.push({
      eventId: population.assessment_event_id,
      unitId: event.unitId,
      unitCode: event.unitCode,
      unitName: event.unitName,
      trainerName: trainerMap.get(`${event.unitId}:${cohort.id}`) ?? '',
      studentId: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      cohortId: cohort.id,
      cohortName: cohort.name,
      attendance: population.attendance_status,
      catReason: population.cat_absence_reason ?? '',
      catRecommendation: population.cat_absence_recommendation ?? '',
      examReason: population.exam_absence_reason ?? '',
      examRecommendation: population.exam_absence_recommendation ?? '',
      assignment: num(marks.assignment),
      presentation: num(marks.presentation),
      rat: num(marks.rat),
      cat1: num(marks.cat1),
      exam: num(marks.exam),
      total: num(result?.total_mark),
      grade: typeof result?.grade === 'string' ? result.grade : null,
    });
  }
  return { periodId: period.id, periodName: period.name, departmentName: profile.departmentName, rows };
}
