import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import { createClient } from '@/lib/supabase/server';

export interface AttachmentStageRule {
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  precedingStageId: string;
  precedingStageCode: string;
  precedingStageName: string;
  attachmentStageId: string;
  attachmentStageCode: string;
  attachmentStageName: string;
  attachmentUnitCode: string;
  attachmentUnitName: string;
  dueCount: number;
}

export interface AttachmentCandidate {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  cohortId: string | null;
  cohortCode: string;
  cohortName: string;
  currentStageId: string | null;
  currentStageCode: string;
  /** Stored stage when it differs from the intake-derived calendar stage (e.g., Y1S2 units in semester 3). */
  unitDeliveryStageCode: string | null;
  attachmentStageId: string | null;
  attachmentStageCode: string;
  attachmentUnitCode: string;
  attachmentUnitName: string;
  isTransferStudent: boolean;
  referredUnitCount: number;
  source: 'auto' | 'manual';
}

export interface ManualOverrideStudentOption {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  cohortId: string | null;
  cohortCode: string;
  cohortName: string;
  currentStageId: string | null;
  currentStageCode: string;
}

export interface NextSemesterAttachmentData {
  departmentName: string;
  rules: AttachmentStageRule[];
  candidates: AttachmentCandidate[];
  otherActiveStudents: ManualOverrideStudentOption[];
}

const ATTACHMENT_UNIT_PATTERN = /\b(attachment|practicum|field\s*work)\b/i;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Computes a cohort's calendar semester number (1-indexed, 4-month terms: Jan/May/Sep)
 * from its intake_date to the active academic period's start date.
 * Does not modify stored student or cohort staging.
 */
function computeCalendarStageSequence(
  intakeDate: string | null | undefined,
  activePeriodStartsOn: string | null | undefined,
): number | null {
  if (!intakeDate || !activePeriodStartsOn) return null;
  const intake = new Date(intakeDate);
  const activeStart = new Date(activePeriodStartsOn);
  if (Number.isNaN(intake.getTime()) || Number.isNaN(activeStart.getTime())) return null;
  const monthsDiff =
    (activeStart.getUTCFullYear() - intake.getUTCFullYear()) * 12 +
    (activeStart.getUTCMonth() - intake.getUTCMonth());
  const seq = Math.floor(monthsDiff / 4) + 1;
  return seq >= 1 ? seq : 1;
}

export const getNextSemesterAttachmentData = cache(async (): Promise<NextSemesterAttachmentData> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return {
      departmentName: profile.departmentName,
      rules: [],
      candidates: [],
      otherActiveStudents: [],
    };
  }

  const supabase = await createClient();
  const departmentId = profile.activeDepartmentId;

  const [activePeriodRes, programmesRes, stagesRes, stageUnitsRes, unitsRes, studentsRes] = await Promise.all([
    supabase
      .from('academic_periods')
      .select('id, code, name, starts_on, status')
      .eq('status', 'active')
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('programmes')
      .select('id, code, name')
      .eq('department_id', departmentId)
      .order('code'),
    supabase
      .from('programme_stages')
      .select('id, programme_id, code, name, sequence_number')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('sequence_number'),
    supabase
      .from('programme_stage_units')
      .select('stage_id, unit_id'),
    supabase
      .from('units')
      .select('id, code, name, programme_id')
      .eq('is_active', true),
    supabase
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        programme_id,
        current_cohort_id,
        admission_cohort_id,
        current_stage_id,
        lifecycle_status,
        academic_phase,
        current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name, intake_date, current_stage_id),
        admission_cohort:cohorts!students_admission_cohort_id_fkey(id, code, name, intake_date, current_stage_id)
      `)
      .eq('department_id', departmentId)
      .in('lifecycle_status', ['admitted', 'active'])
      .eq('academic_phase', 'in_class'),
  ]);

  if (programmesRes.error) throw new Error(`Unable to load programmes: ${programmesRes.error.message}`);
  if (stagesRes.error) throw new Error(`Unable to load programme stages: ${stagesRes.error.message}`);
  if (stageUnitsRes.error) throw new Error(`Unable to load stage curriculum units: ${stageUnitsRes.error.message}`);
  if (unitsRes.error) throw new Error(`Unable to load curriculum units: ${unitsRes.error.message}`);
  if (studentsRes.error) throw new Error(`Unable to load active students: ${studentsRes.error.message}`);

  const activePeriodStartsOn = activePeriodRes.data?.starts_on ?? null;

  const programmeById = new Map((programmesRes.data ?? []).map((p) => [p.id, p]));
  const stages = stagesRes.data ?? [];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stageByProgSeq = new Map(stages.map((s) => [`${s.programme_id}:${s.sequence_number}`, s]));
  const unitById = new Map((unitsRes.data ?? []).map((u) => [u.id, u]));

  // Discover all curriculum attachment stages and their immediately preceding stage
  const ruleByPrecedingStageId = new Map<string, AttachmentStageRule>();
  const rules: AttachmentStageRule[] = [];

  for (const link of stageUnitsRes.data ?? []) {
    const unit = unitById.get(link.unit_id);
    const attStage = stageById.get(link.stage_id);
    if (!unit || !attStage) continue;
    if (!ATTACHMENT_UNIT_PATTERN.test(unit.name ?? '')) continue;

    const prog = programmeById.get(attStage.programme_id);
    if (!prog) continue;

    const prevStage = stageByProgSeq.get(`${attStage.programme_id}:${attStage.sequence_number - 1}`);
    if (!prevStage) continue;

    if (!ruleByPrecedingStageId.has(prevStage.id)) {
      const rule: AttachmentStageRule = {
        programmeId: prog.id,
        programmeCode: prog.code,
        programmeName: prog.name,
        precedingStageId: prevStage.id,
        precedingStageCode: prevStage.code,
        precedingStageName: prevStage.name,
        attachmentStageId: attStage.id,
        attachmentStageCode: attStage.code,
        attachmentStageName: attStage.name,
        attachmentUnitCode: unit.code,
        attachmentUnitName: unit.name,
        dueCount: 0,
      };
      ruleByPrecedingStageId.set(prevStage.id, rule);
      rules.push(rule);
    }
  }

  const activeStudents = studentsRes.data ?? [];
  const dueStudentIds: string[] = [];

  type ResolvedStudentRow = {
    studentId: string;
    admissionNumber: string;
    fullName: string;
    programmeId: string;
    programmeCode: string;
    programmeName: string;
    cohortId: string | null;
    cohortCode: string;
    cohortName: string;
    currentStageId: string | null;
    currentStageCode: string;
    unitDeliveryStageCode: string | null;
    matchedRule: AttachmentStageRule | null;
  };

  const resolvedRows: ResolvedStudentRow[] = [];

  for (const s of activeStudents) {
    const prog = s.programme_id ? programmeById.get(s.programme_id) : null;
    const curCohort = firstOf(s.current_cohort);
    const admCohort = firstOf(s.admission_cohort);
    const cohort = curCohort ?? admCohort;
    const storedStageId = s.current_stage_id ?? cohort?.current_stage_id ?? null;
    const storedStage = storedStageId ? stageById.get(storedStageId) : null;

    // If a student has an individual stage different from their cohort's stage (e.g., held back / deferred
    // in Y1S3 while their cohort is in Y2S1), respect their individual stage so they progress to Y2S1 next
    // instead of skipping ahead to attachment. Otherwise derive calendar stage from current_cohort.intake_date
    // so whole-cohort non-prerequisite unit swaps (e.g., DNDT-JAN-2026 in Y1S3 taking Y1S2 units) are included.
    const hasIndividualStageOverride = Boolean(
      s.current_stage_id && cohort?.current_stage_id && s.current_stage_id !== cohort.current_stage_id,
    );
    const calendarSeq = hasIndividualStageOverride
      ? null
      : computeCalendarStageSequence(cohort?.intake_date, activePeriodStartsOn);
    const calendarStage =
      calendarSeq !== null && s.programme_id
        ? stageByProgSeq.get(`${s.programme_id}:${calendarSeq}`) ?? null
        : null;

    const effectiveStage = calendarStage ?? storedStage;
    const effectiveStageId = effectiveStage?.id ?? storedStageId;
    const matchedRule = effectiveStageId ? ruleByPrecedingStageId.get(effectiveStageId) ?? null : null;

    if (matchedRule) {
      matchedRule.dueCount += 1;
      dueStudentIds.push(s.id);
    }

    const unitDeliveryStageCode =
      storedStage && effectiveStage && storedStage.code !== effectiveStage.code ? storedStage.code : null;

    resolvedRows.push({
      studentId: s.id,
      admissionNumber: s.admission_number ?? '—',
      fullName: s.full_name ?? 'Unknown Student',
      programmeId: prog?.id ?? s.programme_id ?? '',
      programmeCode: prog?.code ?? '—',
      programmeName: prog?.name ?? 'Unassigned',
      cohortId: cohort?.id ?? null,
      cohortCode: cohort?.code ?? '—',
      cohortName: cohort?.name ?? cohort?.code ?? 'Unassigned',
      currentStageId: effectiveStageId,
      currentStageCode: effectiveStage?.code ?? '—',
      unitDeliveryStageCode,
      matchedRule,
    });
  }

  // Load readiness flags (transfer class assignments & referred exam results) for due students
  const transferStudentIds = new Set<string>();
  const referredCountByStudent = new Map<string, number>();

  if (dueStudentIds.length > 0) {
    const [assignmentsRes, resultsRes] = await Promise.all([
      supabase
        .from('student_class_assignments')
        .select('student_id')
        .in('student_id', dueStudentIds)
        .eq('is_active', true),
      supabase
        .from('assessment_results')
        .select('student_id, grade')
        .in('student_id', dueStudentIds),
    ]);

    for (const row of assignmentsRes.data ?? []) {
      if (row.student_id) transferStudentIds.add(row.student_id);
    }
    for (const row of resultsRes.data ?? []) {
      const grade = (row.grade ?? '').toUpperCase();
      if (row.student_id && (grade.includes('REFER') || grade.includes('FAIL'))) {
        referredCountByStudent.set(row.student_id, (referredCountByStudent.get(row.student_id) ?? 0) + 1);
      }
    }
  }

  const candidates: AttachmentCandidate[] = [];
  const otherActiveStudents: ManualOverrideStudentOption[] = [];

  for (const row of resolvedRows) {
    if (row.matchedRule) {
      candidates.push({
        studentId: row.studentId,
        admissionNumber: row.admissionNumber,
        fullName: row.fullName,
        programmeId: row.programmeId,
        programmeCode: row.programmeCode,
        programmeName: row.programmeName,
        cohortId: row.cohortId,
        cohortCode: row.cohortCode,
        cohortName: row.cohortName,
        currentStageId: row.currentStageId,
        currentStageCode: row.currentStageCode,
        unitDeliveryStageCode: row.unitDeliveryStageCode,
        attachmentStageId: row.matchedRule.attachmentStageId,
        attachmentStageCode: row.matchedRule.attachmentStageCode,
        attachmentUnitCode: row.matchedRule.attachmentUnitCode,
        attachmentUnitName: row.matchedRule.attachmentUnitName,
        isTransferStudent: transferStudentIds.has(row.studentId),
        referredUnitCount: referredCountByStudent.get(row.studentId) ?? 0,
        source: 'auto',
      });
    } else {
      otherActiveStudents.push({
        studentId: row.studentId,
        admissionNumber: row.admissionNumber,
        fullName: row.fullName,
        programmeId: row.programmeId,
        programmeCode: row.programmeCode,
        programmeName: row.programmeName,
        cohortId: row.cohortId,
        cohortCode: row.cohortCode,
        cohortName: row.cohortName,
        currentStageId: row.currentStageId,
        currentStageCode: row.currentStageCode,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      a.programmeCode.localeCompare(b.programmeCode) ||
      a.cohortName.localeCompare(b.cohortName) ||
      compareAdmissionNumbers(a.admissionNumber, b.admissionNumber),
  );

  otherActiveStudents.sort(
    (a, b) =>
      a.programmeCode.localeCompare(b.programmeCode) ||
      compareAdmissionNumbers(a.admissionNumber, b.admissionNumber),
  );

  rules.sort(
    (a, b) =>
      b.dueCount - a.dueCount ||
      a.programmeCode.localeCompare(b.programmeCode) ||
      a.attachmentStageCode.localeCompare(b.attachmentStageCode),
  );

  return {
    departmentName: profile.departmentName,
    rules,
    candidates,
    otherActiveStudents,
  };
});
