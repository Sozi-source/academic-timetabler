import { requireHodAccess } from '@/features/auth/authorization';
import { loadUnitSiblingResolver } from '@/features/assessment/unit-sibling-groups';
import { calculateOnlineFinalTotal } from '@/features/staff-assessment/online-marks-domain';
import { createAdminClient } from '@/lib/supabase/admin';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function num(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

const ALLOCATION_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  completed: 1,
  draft: 2,
  archived: 3,
};

function allocationStatusRank(status: string | null | undefined): number {
  return ALLOCATION_STATUS_PRIORITY[(status ?? '').toLowerCase()] ?? 9;
}

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

export type MarkProvenanceSource = 'committed' | 'submitted' | 'draft' | 'absent' | 'none';

export interface ReportStudentRow {
  eventId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  trainerName: string;
  trainerHomeDepartment?: string;
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
  catSource?: MarkProvenanceSource;
  examSource?: Exclude<MarkProvenanceSource, 'submitted'>;
}

export interface AssessmentPeriodReportData {
  periodId: string;
  periodName: string;
  departmentName: string;
  periods: Array<{ id: string; name: string; status: string }>;
  rows: ReportStudentRow[];
}

function rowMarkCompleteness(row: ReportStudentRow): number {
  return (
    (row.cat1 !== null ? 1 : 0) +
    (row.exam !== null ? 2 : 0) +
    (row.total !== null ? 1 : 0) +
    (row.rat !== null || row.assignment !== null || row.presentation !== null ? 0.5 : 0)
  );
}

/**
 * Deduplicate sibling rows representing the same shared/equivalent class for a student.
 * Mark completeness comes first, then exact unit registration breaks ties so students in a cohort
 * stay aligned on their actual registered unit codes rather than arbitrary population row ordering.
 */
export function deduplicateSiblingReportRows(
  rows: ReportStudentRow[],
  groupKeyOf: (unitId: string) => string,
  registeredUnitIdsByStudent: ReadonlyMap<string, ReadonlySet<string>>,
): ReportStudentRow[] {
  const dedupedRows = new Map<string, ReportStudentRow>();
  for (const row of rows) {
    const key = `${row.studentId}:${groupKeyOf(row.unitId)}`;
    const existing = dedupedRows.get(key);
    if (!existing) {
      dedupedRows.set(key, row);
      continue;
    }

    const existingScore = rowMarkCompleteness(existing);
    const nextScore = rowMarkCompleteness(row);
    if (nextScore !== existingScore) {
      if (nextScore > existingScore) dedupedRows.set(key, row);
      continue;
    }

    const existingRegistered = registeredUnitIdsByStudent.get(existing.studentId)?.has(existing.unitId) ? 1 : 0;
    const nextRegistered = registeredUnitIdsByStudent.get(row.studentId)?.has(row.unitId) ? 1 : 0;
    if (nextRegistered !== existingRegistered) {
      if (nextRegistered > existingRegistered) dedupedRows.set(key, row);
      continue;
    }

    if (row.unitCode.localeCompare(existing.unitCode) < 0) {
      dedupedRows.set(key, row);
    }
  }
  return Array.from(dedupedRows.values());
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

  const candidateEvents = (events ?? []).filter((e) => e.assessment_type === 'exam' || e.title === 'Unit Markbook');
  const excludedIds = new Set<string>();
  if (candidateEvents.length > 0) {
    const { data: excludedRows, error: excludedError } = await admin
      .from('assessment_events')
      .select('id')
      .in('id', candidateEvents.map((e) => e.id))
      .eq('exclude_from_analysis', true);
    if (!excludedError) {
      for (const row of excludedRows ?? []) {
        if (row.id) excludedIds.add(row.id);
      }
    }
  }
  const validEvents = candidateEvents.filter((e) => !excludedIds.has(e.id));
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

  // Shared / equivalent classes keep their marks on ONE root assessment event while
  // every participating unit has its own event + population. Resolve siblings so
  // marks and trainers recorded on a sibling event are never reported as "missed".
  const siblingResolver = await loadUnitSiblingResolver(admin, period.id);
  const eventIdByUnit = new Map(validEvents.map((event) => [event.unit_id, event.id]));
  const siblingEventIdsOf = (event: { id: string; unit_id: string }) =>
    siblingResolver
      .siblingsOf(event.unit_id)
      .map((unitId) => eventIdByUnit.get(unitId))
      .filter((id): id is string => Boolean(id) && id !== event.id);
  const allocationUnitIds = [
    ...new Set([...unitIds, ...unitIds.flatMap((unitId) => siblingResolver.siblingsOf(unitId))]),
  ];

  type PopulationRow = {
    assessment_event_id: string;
    student_id: string;
    cohort_id: string | null;
    attendance_status: 'pending' | 'present' | 'absent';
    cat_absence_reason: string | null;
    cat_absence_recommendation: string | null;
    exam_absence_reason: string | null;
    exam_absence_recommendation: string | null;
    student: Relation<{
      id: string;
      admission_number: string;
      full_name: string;
      lifecycle_status?: string | null;
      academic_phase?: string | null;
    }>;
    cohort: Relation<{ id: string; code: string; name: string }>;
  };
  type ResultRow = {
    assessment_event_id: string;
    student_id: string;
    component_marks: Record<string, unknown> | null;
    total_mark: number | null;
    grade: string | null;
  };
  type AllocationRow = {
    unit_id: string;
    cohort_id: string | null;
    participant_cohort_ids: string[] | null;
    status: string | null;
    trainer: Relation<{ full_name: string; home_department?: string | null }>;
  };
  type DraftRow = {
    assessment_id: string;
    student_id: string;
    assignment_mark: number | null;
    presentation_mark: number | null;
    rat_mark: number | null;
    cat_mark: number | null;
    exam_mark: number | null;
    updated_at: string | null;
  };
  type RosterRow = {
    assessment_id: string;
    student_id: string;
    cat_absent: boolean | null;
    pre_assessment_status: string | null;
  };
  type ComponentSubmissionRow = {
    assessment_id: string;
    cohort_id: string | null;
    component_key: string;
  };
  type PeriodReportingRow = {
    student_id: string;
    reporting_status: string | null;
  };
  type RegistrationRow = {
    student_id: string;
    unit_id: string;
  };
  type RegistrationCandidateRow = {
    student_id: string;
    unit_id: string;
    cohort_id: string | null;
    student: PopulationRow['student'];
    cohort: PopulationRow['cohort'];
  };

  const [
    populations,
    results,
    allocations,
    drafts,
    rosterRows,
    componentSubmissions,
    periodReportingRows,
    activeRegistrations,
    registrationCandidates,
  ] = await Promise.all([
    fetchAllRows<PopulationRow>(
      () =>
        admin
          .from('assessment_population')
          .select(`
            assessment_event_id,student_id,cohort_id,attendance_status,
            cat_absence_reason,cat_absence_recommendation,exam_absence_reason,exam_absence_recommendation,
            student:students(id,admission_number,full_name,lifecycle_status,academic_phase),cohort:cohorts(id,code,name)
          `)
          .in('assessment_event_id', eventIds)
          .eq('population_status', 'expected')
          .order('id', { ascending: true }),
      'assessment populations',
    ),
    fetchAllRows<ResultRow>(
      () =>
        admin
          .from('assessment_results')
          .select('assessment_event_id,student_id,component_marks,total_mark,grade')
          .in('assessment_event_id', eventIds)
          .order('id', { ascending: true }),
      'assessment results',
    ),
    fetchAllRows<AllocationRow>(
      () =>
        admin
          .from('teaching_allocations')
          .select('unit_id,cohort_id,participant_cohort_ids,status,trainer:trainers(full_name,home_department)')
          .eq('academic_period_id', period.id)
          .in('unit_id', allocationUnitIds)
          .in('status', ['draft', 'active', 'completed', 'archived'])
          .order('id', { ascending: true }),
      'trainers',
    ),
    fetchAllRows<DraftRow>(
      () =>
        admin
          .from('assessment_online_mark_drafts')
          .select('assessment_id,student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark,updated_at')
          .in('assessment_id', eventIds)
          .order('id', { ascending: true }),
      'mark drafts',
    ),
    fetchAllRows<RosterRow>(
      () =>
        admin
          .from('assessment_roster')
          .select('assessment_id,student_id,cat_absent,pre_assessment_status')
          .in('assessment_id', eventIds)
          .order('id', { ascending: true }),
      'assessment roster',
    ),
    fetchAllRows<ComponentSubmissionRow>(
      () =>
        admin
          .from('assessment_mark_component_submissions')
          .select('assessment_id,cohort_id,component_key')
          .in('assessment_id', eventIds)
          .eq('component_key', 'cat')
          .order('id', { ascending: true }),
      'submitted CAT marks',
    ),
    fetchAllRows<PeriodReportingRow>(
      () =>
        admin
          .from('student_period_reporting')
          .select('student_id,reporting_status')
          .eq('academic_period_id', period.id)
          .in('reporting_status', ['deferred', 'dropped_out']),
      'period reporting',
    ).catch(() => [] as PeriodReportingRow[]),
    fetchAllRows<RegistrationRow>(
      () =>
        admin
          .from('student_unit_registrations')
          .select('student_id,unit_id')
          .eq('academic_period_id', period.id)
          .eq('registration_status', 'registered')
          .in('unit_id', allocationUnitIds)
          .order('id', { ascending: true }),
      'unit registrations',
    ),
    fetchAllRows<RegistrationCandidateRow>(
      () =>
        admin
          .from('assessment_registration_candidates')
          .select(`
            student_id,unit_id,cohort_id,
            student:students(id,admission_number,full_name,lifecycle_status,academic_phase),
            cohort:cohorts(id,code,name)
          `)
          .eq('academic_period_id', period.id)
          .eq('registration_status', 'registered')
          .in('unit_id', unitIds)
          .order('student_id', { ascending: true }),
      'registration candidates',
    ).catch(() => [] as RegistrationCandidateRow[]),
  ]);

  const inactivePeriodStudents = new Set(periodReportingRows.map((r) => r.student_id));
  const registeredGroupKeysByStudent = new Map<string, Set<string>>();
  const registeredUnitIdsByStudent = new Map<string, Set<string>>();
  for (const reg of activeRegistrations) {
    if (!reg.student_id || !reg.unit_id) continue;
    let groupKeys = registeredGroupKeysByStudent.get(reg.student_id);
    if (!groupKeys) {
      groupKeys = new Set<string>();
      registeredGroupKeysByStudent.set(reg.student_id, groupKeys);
    }
    groupKeys.add(siblingResolver.groupKeyOf(reg.unit_id));

    let registeredUnits = registeredUnitIdsByStudent.get(reg.student_id);
    if (!registeredUnits) {
      registeredUnits = new Set<string>();
      registeredUnitIdsByStudent.set(reg.student_id, registeredUnits);
    }
    registeredUnits.add(reg.unit_id);
  }

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

  const trainerMap = new Map<string, { fullName: string; homeDepartment: string }>();
  const trainerByUnit = new Map<string, { fullName: string; homeDepartment: string }>();
  // Sort so active > completed > draft > archived; never let archived overwrite active
  const prioritizedAllocations = [...allocations].sort(
    (a, b) => allocationStatusRank(a.status) - allocationStatusRank(b.status),
  );
  for (const allocation of prioritizedAllocations) {
    const trainer = one(allocation.trainer);
    if (!trainer?.full_name) continue;
    const trainerInfo = {
      fullName: trainer.full_name,
      homeDepartment: trainer.home_department?.trim() ?? '',
    };
    const cohortIds = new Set<string>(
      [allocation.cohort_id, ...(allocation.participant_cohort_ids ?? [])].filter((id): id is string => Boolean(id)),
    );
    for (const cohortId of cohortIds) {
      const k = `${allocation.unit_id}:${cohortId}`;
      if (!trainerMap.has(k)) trainerMap.set(k, trainerInfo);
    }
    if (!trainerByUnit.has(allocation.unit_id)) trainerByUnit.set(allocation.unit_id, trainerInfo);
  }

  /** Trainer name and home department for a unit/cohort, falling back to shared/equivalent sibling units. */
  const resolveTrainerInfo = (unitId: string, cohortId: string) => {
    const exact = trainerMap.get(`${unitId}:${cohortId}`);
    if (exact) return exact;
    const siblingUnits = siblingResolver.siblingsOf(unitId);
    for (const siblingUnitId of siblingUnits) {
      const viaCohort = trainerMap.get(`${siblingUnitId}:${cohortId}`);
      if (viaCohort) return viaCohort;
    }
    return (
      trainerByUnit.get(unitId)
      ?? siblingUnits.map((id) => trainerByUnit.get(id)).find(Boolean)
      ?? { fullName: '', homeDepartment: '' }
    );
  };

  // Fill in registered active candidates whose assessment_population snapshot is missing so
  // Control Center and Consolidated Reports stay synchronized without mutating existing population rows.
  const populatedKeys = new Set<string>();
  for (const pop of populations ?? []) {
    const event = eventMap.get(pop.assessment_event_id);
    if (event) {
      populatedKeys.add(`${pop.student_id}:${siblingResolver.groupKeyOf(event.unitId)}`);
    }
  }
  const effectivePopulations: PopulationRow[] = [...(populations ?? [])];
  for (const cand of registrationCandidates) {
    const eventId = eventIdByUnit.get(cand.unit_id);
    if (!eventId) continue;
    const groupKey = `${cand.student_id}:${siblingResolver.groupKeyOf(cand.unit_id)}`;
    if (populatedKeys.has(groupKey)) continue;
    populatedKeys.add(groupKey);
    effectivePopulations.push({
      assessment_event_id: eventId,
      student_id: cand.student_id,
      cohort_id: cand.cohort_id,
      attendance_status: 'pending',
      cat_absence_reason: null,
      cat_absence_recommendation: null,
      exam_absence_reason: null,
      exam_absence_recommendation: null,
      student: cand.student,
      cohort: cand.cohort,
    });
  }

  const rows: ReportStudentRow[] = [];
  for (const population of effectivePopulations) {
    const student = one(
      population.student as Relation<{
        id: string;
        admission_number: string;
        full_name: string;
        lifecycle_status?: string | null;
        academic_phase?: string | null;
      }>,
    );
    const cohort = one(population.cohort as Relation<{ id: string; code: string; name: string }>);
    const event = eventMap.get(population.assessment_event_id);
    if (!student || !cohort || !event) continue;

    const lifecycle = (student.lifecycle_status ?? '').toLowerCase();
    if (lifecycle && !['admitted', 'active'].includes(lifecycle)) continue;
    const phase = (student.academic_phase ?? '').toLowerCase();
    if (phase && phase !== 'in_class') continue;
    if (inactivePeriodStudents.has(student.id)) continue;

    // Candidate events that may hold this student's marks: the population event first,
    // then its shared/equivalent siblings (where the trainer actually entered the marks).
    const populationEvent = { id: population.assessment_event_id, unit_id: event.unitId };
    const candidateEventIds = [populationEvent.id, ...siblingEventIdsOf(populationEvent)];
    const catOfResult = (candidateKey: string) => {
      const m = (resultMap.get(candidateKey)?.component_marks ?? {}) as Record<string, unknown>;
      return num(m.cat1) ?? num(m.cat);
    };
    const hasCat = (candidateId: string) => {
      const candidateKey = `${candidateId}:${student.id}`;
      return num(draftMap.get(candidateKey)?.cat_mark) !== null || catOfResult(candidateKey) !== null;
    };
    const hasAnyMarks = (candidateId: string) => {
      const candidateKey = `${candidateId}:${student.id}`;
      return draftMap.has(candidateKey) || resultMap.has(candidateKey);
    };
    const sourceEventId =
      candidateEventIds.find(hasCat)
      ?? candidateEventIds.find((candidateId) => rosterMap.get(`${candidateId}:${student.id}`)?.cat_absent)
      ?? candidateEventIds.find(hasAnyMarks)
      ?? populationEvent.id;

    const key = `${sourceEventId}:${student.id}`;
    const result = resultMap.get(key);
    const isRegisteredForGroup =
      registeredGroupKeysByStudent.get(student.id)?.has(siblingResolver.groupKeyOf(event.unitId)) ?? false;
    if (!isRegisteredForGroup && !result) continue;

    const draft = draftMap.get(key);
    const roster = rosterMap.get(key);
    const ownRoster = rosterMap.get(`${population.assessment_event_id}:${student.id}`);

    const isExamAbsent = population.attendance_status === 'absent' || ownRoster?.pre_assessment_status === 'absent' || roster?.pre_assessment_status === 'absent';
    const isCatAbsent = Boolean(roster?.cat_absent);

    const marks = (result?.component_marks ?? {}) as Record<string, unknown>;
    const catWasSubmitted = candidateEventIds.some((candidateId) =>
      submittedCatScopes.has(`${candidateId}:${population.cohort_id ?? 'all'}`)
      || submittedCatScopes.has(`${candidateId}:all`),
    );
    const submittedDraftCat = catWasSubmitted ? num(draft?.cat_mark) : null;

    const assignment = num(marks.assignment) ?? num(draft?.assignment_mark);
    const presentation = num(marks.presentation) ?? num(draft?.presentation_mark);
    const rat = num(marks.rat) ?? num(draft?.rat_mark);
    const committedCat = num(marks.cat1) ?? num(marks.cat);
    const cat1 = isCatAbsent ? null : (submittedDraftCat ?? committedCat ?? num(draft?.cat_mark));
    const committedExam = num(marks.exam);
    const exam = isExamAbsent ? null : (committedExam ?? num(draft?.exam_mark));

    const catSource: MarkProvenanceSource = isCatAbsent
      ? 'absent'
      : committedCat !== null
        ? 'committed'
        : submittedDraftCat !== null
          ? 'submitted'
          : cat1 !== null
            ? 'draft'
            : 'none';
    const examSource: Exclude<MarkProvenanceSource, 'submitted'> = isExamAbsent
      ? 'absent'
      : (num(result?.total_mark) !== null || committedExam !== null || num(marks.total) !== null)
        ? 'committed'
        : exam !== null
          ? 'draft'
          : 'none';
    const trainerInfo = resolveTrainerInfo(event.unitId, cohort.id);

    let total = isExamAbsent ? null : (num(result?.total_mark) ?? num(marks.total));
    if (total === null && !isExamAbsent && cat1 !== null && exam !== null) {
      const calculated = calculateOnlineFinalTotal({ assignment, presentation, rat, cat: cat1, exam }, false);
      total = calculated !== null ? Math.round(calculated) : null;
    } else if (total !== null) {
      total = Math.round(total);
    }

    let grade = isExamAbsent ? 'ABSENT' : (typeof result?.grade === 'string' ? result.grade : null);
    if (!grade) {
      if (isExamAbsent) grade = 'ABSENT';
      else if (total !== null) {
        if (total >= 75) grade = 'DISTINCTION';
        else if (total >= 65) grade = 'CREDIT';
        else if (total >= 50) grade = 'SATISFACTORY';
        else if (total >= 40) grade = 'PASS';
        else grade = 'FAIL';
      }
    }

    rows.push({
      eventId: population.assessment_event_id,
      unitId: event.unitId,
      unitCode: event.unitCode,
      unitName: event.unitName,
      trainerName: trainerInfo.fullName,
      trainerHomeDepartment: trainerInfo.homeDepartment || undefined,
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
      catSource,
      examSource,
    });
  }

  return {
    periodId: period.id,
    periodName: period.name,
    departmentName: profile.departmentName,
    periods: periodsList,
    rows: deduplicateSiblingReportRows(rows, siblingResolver.groupKeyOf, registeredUnitIdsByStudent),
  };
}
