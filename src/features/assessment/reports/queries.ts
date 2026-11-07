import { requireHodAccess } from '@/features/auth/authorization';
import { calculateOnlineFinalTotal } from '@/features/staff-assessment/online-marks-domain';
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
  periods: Array<{ id: string; name: string; status: string }>;
  rows: ReportStudentRow[];
}

export async function getActiveAssessmentPeriodReportData(
  targetPeriodId?: string,
): Promise<AssessmentPeriodReportData | null> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const admin = createAdminClient();

  const { data: allPeriods, error: periodsError } = await admin
    .from('academic_periods')
    .select('id,name,status,starts_on')
    .order('starts_on', { ascending: false });
  if (periodsError) throw new Error(`Unable to load academic periods: ${periodsError.message}`);
  if (!allPeriods?.length) return null;

  const period = targetPeriodId
    ? allPeriods.find((p) => p.id === targetPeriodId) ?? allPeriods[0]
    : allPeriods.find((p) => p.status === 'active') ?? allPeriods[0];
  if (!period) return null;

  const periodsList = allPeriods.map((p) => ({ id: p.id, name: p.name, status: p.status }));

  const { data: events, error: eventsError } = await admin
    .from('assessment_events')
    .select('id,unit_id,title,assessment_type,unit:units(id,code,name)')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', period.id);
  if (eventsError) throw new Error(`Unable to load unit markbooks: ${eventsError.message}`);

  const validEvents = (events ?? []).filter((e) => e.assessment_type === 'exam' || e.title === 'Unit Markbook');
  if (!validEvents.length) {
    return {
      periodId: period.id,
      periodName: period.name,
      departmentName: profile.departmentName,
      periods: periodsList,
      rows: [],
    };
  }

  const eventIds = validEvents.map((event) => event.id);
  const unitIds = [...new Set(validEvents.map((event) => event.unit_id))];

  const [
    { data: populations, error: populationError },
    { data: results, error: resultsError },
    { data: allocations, error: allocationError },
    { data: drafts, error: draftsError },
    { data: rosterRows, error: rosterError },
    { data: componentSubmissions, error: componentSubmissionsError },
  ] = await Promise.all([
    admin
      .from('assessment_population')
      .select(`
        assessment_event_id,student_id,cohort_id,attendance_status,
        cat_absence_reason,cat_absence_recommendation,exam_absence_reason,exam_absence_recommendation,
        student:students(id,admission_number,full_name),cohort:cohorts(id,code,name)
      `)
      .in('assessment_event_id', eventIds)
      .eq('population_status', 'expected'),
    admin
      .from('assessment_results')
      .select('assessment_event_id,student_id,component_marks,total_mark,grade')
      .in('assessment_event_id', eventIds),
    admin
      .from('teaching_allocations')
      .select('unit_id,cohort_id,participant_cohort_ids,trainer:trainers(full_name)')
      .eq('academic_period_id', period.id)
      .in('unit_id', unitIds)
      .in('status', ['draft', 'active']),
    admin
      .from('assessment_online_mark_drafts')
      .select('assessment_id,student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark,updated_at')
      .in('assessment_id', eventIds),
    admin
      .from('assessment_roster')
      .select('assessment_id,student_id,cat_absent,pre_assessment_status')
      .in('assessment_id', eventIds),
    admin
      .from('assessment_mark_component_submissions')
      .select('assessment_id,cohort_id,component_key')
      .in('assessment_id', eventIds)
      .eq('component_key', 'cat'),
  ]);

  if (populationError) throw new Error(`Unable to load assessment populations: ${populationError.message}`);
  if (resultsError) throw new Error(`Unable to load assessment results: ${resultsError.message}`);
  if (allocationError) throw new Error(`Unable to load trainers: ${allocationError.message}`);
  if (draftsError) throw new Error(`Unable to load mark drafts: ${draftsError.message}`);
  if (rosterError) throw new Error(`Unable to load assessment roster: ${rosterError.message}`);
  if (componentSubmissionsError) throw new Error(`Unable to load submitted CAT marks: ${componentSubmissionsError.message}`);

  const eventMap = new Map(validEvents.map((event) => {
    const unit = one(event.unit as Relation<{ id: string; code: string; name: string }>);
    return [event.id, { unitId: event.unit_id, unitCode: unit?.code ?? '', unitName: unit?.name ?? '' }];
  }));

  const resultMap = new Map((results ?? []).map((result) => [`${result.assessment_event_id}:${result.student_id}`, result]));

  const draftMap = new Map<string, (typeof drafts)[number]>();
  for (const d of drafts ?? []) {
    if (!d.assessment_id || !d.student_id) continue;
    const k = `${d.assessment_id}:${d.student_id}`;
    const existing = draftMap.get(k);
    if (!existing || String(d.updated_at ?? '') > String(existing.updated_at ?? '')) {
      draftMap.set(k, d);
    }
  }

  const rosterMap = new Map((rosterRows ?? []).map((r) => [`${r.assessment_id}:${r.student_id}`, r]));
  const submittedCatScopes = new Set((componentSubmissions ?? []).map((submission) => `${submission.assessment_id}:${submission.cohort_id ?? 'all'}`));

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

    const key = `${population.assessment_event_id}:${student.id}`;
    const result = resultMap.get(key);
    const draft = draftMap.get(key);
    const roster = rosterMap.get(key);

    const isExamAbsent = population.attendance_status === 'absent' || roster?.pre_assessment_status === 'absent';
    const isCatAbsent = Boolean(roster?.cat_absent);

    const marks = (result?.component_marks ?? {}) as Record<string, unknown>;
    const catWasSubmitted = submittedCatScopes.has(`${population.assessment_event_id}:${population.cohort_id ?? 'all'}`);
    const submittedDraftCat = catWasSubmitted ? num(draft?.cat_mark) : null;

    const assignment = num(marks.assignment) ?? num(draft?.assignment_mark);
    const presentation = num(marks.presentation) ?? num(draft?.presentation_mark);
    const rat = num(marks.rat) ?? num(draft?.rat_mark);
    const cat1 = isCatAbsent ? null : (submittedDraftCat ?? num(marks.cat1) ?? num(marks.cat) ?? num(draft?.cat_mark));
    const exam = isExamAbsent ? null : (num(marks.exam) ?? num(draft?.exam_mark));

    let total = num(result?.total_mark) ?? num(marks.total);
    if (total === null && !isExamAbsent && assignment !== null && presentation !== null && rat !== null && cat1 !== null && exam !== null) {
      total = calculateOnlineFinalTotal({ assignment, presentation, rat, cat: cat1, exam }, false);
    }

    let grade = typeof result?.grade === 'string' ? result.grade : null;
    if (!grade) {
      if (isExamAbsent) grade = 'ABSENT';
      else if (total !== null) {
        if (total >= 75) grade = 'DISTINCTION';
        else if (total >= 65) grade = 'CREDIT';
        else if (total >= 40) grade = 'PASS';
        else grade = 'REFER';
      }
    }

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
      attendance: isExamAbsent ? 'absent' : population.attendance_status,
      catReason: population.cat_absence_reason ?? '',
      catRecommendation: population.cat_absence_recommendation ?? '',
      examReason: population.exam_absence_reason ?? '',
      examRecommendation: population.exam_absence_recommendation ?? '',
      assignment,
      presentation,
      rat,
      cat1,
      exam,
      total,
      grade,
    });
  }

  return {
    periodId: period.id,
    periodName: period.name,
    departmentName: profile.departmentName,
    periods: periodsList,
    rows,
  };
}
