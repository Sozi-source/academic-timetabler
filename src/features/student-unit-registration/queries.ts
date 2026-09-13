import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type { DepartmentRegistrationEditor, DepartmentRegistrationUnit, ProgrammeStageSetup, RegistrationStudent, UnitRegistrationContext } from './types';

export const getUnitRegistrationContext = cache(async (): Promise<UnitRegistrationContext> => {
  const supabase = await createClient();

  const { data: period, error: periodError } = await supabase
    .from('academic_periods')
    .select('id, code, name')
    .eq('status', 'active')
    .maybeSingle();

  if (periodError) throw new Error(`Unable to load active academic period: ${periodError.message}`);
  if (!period) {
    return {
      period: null,
      students: [],
      expectedUnitTotal: 0,
      selectedUnitTotal: 0,
      submittedCount: 0,
      verifiedCount: 0,
      exceptionCount: 0,
    };
  }

  const fetchAllRegistrations = async (periodId: string) => {
    const PAGE_SIZE = 1000;
    const allRegistrations: Array<{ student_id: string; unit_id: string; registration_status: string }> = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('student_unit_registrations')
        .select('student_id, unit_id, registration_status')
        .eq('academic_period_id', periodId)
        .eq('registration_status', 'registered')
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(`Unable to load registrations: ${error.message}`);
      if (!data || data.length === 0) break;
      allRegistrations.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRegistrations;
  };

  const [studentResult, offeringResult, allRegistrations, submissionResult, stageUnitOverviewResult] = await Promise.all([
    supabase
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        current_cohort_id,
        current_stage_id,
        programme:programmes!students_programme_id_fkey(code),
        current_cohort:cohorts!students_current_cohort_id_fkey(id, name)
      `)
      .in('lifecycle_status', ['admitted', 'active'])
      .order('full_name', { ascending: true }),
    supabase
      .from('unit_offerings')
      .select('id, cohort_id, unit_id')
      .eq('academic_period_id', period.id)
      .eq('selection_state', 'included')
      .neq('status', 'cancelled'),
    fetchAllRegistrations(period.id),
    supabase
      .from('student_unit_registration_submissions')
      .select('id, student_id, status, has_exception, exception_reason, verification_note')
      .eq('academic_period_id', period.id),
    supabase
      .from('programme_stage_units')
      .select('stage_id, unit_id'),
  ]);

  if (studentResult.error) throw new Error(`Unable to load students: ${studentResult.error.message}`);
  if (offeringResult.error) throw new Error(`Unable to load offered units: ${offeringResult.error.message}`);
  if (submissionResult.error) throw new Error(`Unable to load submissions: ${submissionResult.error.message}`);
  if (stageUnitOverviewResult.error) throw new Error(`Unable to load stage units: ${stageUnitOverviewResult.error.message}`);

  const offeringsByCohort = new Map<string, number>();
  for (const offering of offeringResult.data ?? []) {
    offeringsByCohort.set(offering.cohort_id, (offeringsByCohort.get(offering.cohort_id) ?? 0) + 1);
  }

  const unitsByStage = new Map<string, number>();
  for (const row of stageUnitOverviewResult.data ?? []) {
    unitsByStage.set(row.stage_id, (unitsByStage.get(row.stage_id) ?? 0) + 1);
  }

  const selectionsByStudent = new Map<string, number>();
  for (const registration of allRegistrations) {
    selectionsByStudent.set(registration.student_id, (selectionsByStudent.get(registration.student_id) ?? 0) + 1);
  }

  const submissionByStudent = new Map((submissionResult.data ?? []).map((submission) => [submission.student_id, submission]));

  const students: RegistrationStudent[] = (studentResult.data ?? []).map((student) => {
    const programme = Array.isArray(student.programme) ? student.programme[0] : student.programme;
    const cohort = Array.isArray(student.current_cohort) ? student.current_cohort[0] : student.current_cohort;
    const cohortId = student.current_cohort_id;
    const submission = submissionByStudent.get(student.id);

    return {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode: programme?.code ?? '-',
      cohortId,
      cohortName: cohort?.name ?? null,
      expectedUnits: student.current_stage_id
        ? (unitsByStage.get(student.current_stage_id) ?? 0)
        : cohortId
          ? (offeringsByCohort.get(cohortId) ?? 0)
          : 0,
      selectedUnits: selectionsByStudent.get(student.id) ?? 0,
      submissionId: submission?.id ?? null,
      status: submission?.status ?? 'not_submitted',
      hasException: submission?.has_exception ?? false,
      exceptionReason: submission?.exception_reason ?? null,
      verificationNote: submission?.verification_note ?? null,
    };
  });

  return {
    period: { id: period.id, code: period.code, name: period.name },
    students,
    expectedUnitTotal: students.reduce((sum, student) => sum + student.expectedUnits, 0),
    selectedUnitTotal: students.reduce((sum, student) => sum + student.selectedUnits, 0),
    submittedCount: students.filter((student) => student.status === 'submitted').length,
    verifiedCount: students.filter((student) => student.status === 'verified').length,
    exceptionCount: students.filter((student) => student.hasException && ['submitted', 'verified'].includes(student.status)).length,
  };
});


export async function getDepartmentRegistrationEditor(
  studentId: string,
): Promise<DepartmentRegistrationEditor | null> {
  const supabase = await createClient();

  const { data: period, error: periodError } = await supabase
    .from('academic_periods')
    .select('id, code, name')
    .eq('status', 'active')
    .maybeSingle();

  if (periodError) throw new Error(`Unable to load active academic period: ${periodError.message}`);
  if (!period) return null;

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      admission_number,
      full_name,
      programme_id,
      current_cohort_id,
      current_stage_id,
      lifecycle_status,
      current_stage:programme_stages!students_current_stage_id_fkey(id, name, code, sequence_number),
      programme:programmes!students_programme_id_fkey(code),
      current_cohort:cohorts!students_current_cohort_id_fkey(name, current_stage_id)
    `)
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) throw new Error(`Unable to load student: ${studentError.message}`);
  if (!student || !['admitted', 'active'].includes(student.lifecycle_status) || !student.current_cohort_id) {
    return null;
  }

  const [offeringResult, registrationResult, submissionResult, stageResult, stageUnitResult, programmeUnitsResult] = await Promise.all([
    supabase
      .from('unit_offerings')
      .select(`
        id,
        cohort_id,
        unit_id,
        unit:units!unit_offerings_unit_id_fkey(id, code, name, programme_id)
      `)
      .eq('academic_period_id', period.id)
      .eq('selection_state', 'included')
      .neq('status', 'cancelled'),
    supabase
      .from('student_unit_registrations')
      .select('unit_id')
      .eq('student_id', student.id)
      .eq('academic_period_id', period.id)
      .eq('registration_status', 'registered'),
    supabase
      .from('student_unit_registration_submissions')
      .select('status, exception_reason, verification_note')
      .eq('student_id', student.id)
      .eq('academic_period_id', period.id)
      .maybeSingle(),
    supabase
      .from('programme_stages')
      .select('id, name, code, sequence_number')
      .eq('programme_id', student.programme_id)
      .eq('is_active', true)
      .order('sequence_number', { ascending: true }),
    supabase
      .from('programme_stage_units')
      .select('stage_id, unit_id'),
    supabase
      .from('units')
      .select('id, code, name, academic_period_number')
      .eq('programme_id', student.programme_id)
      .order('code', { ascending: true }),
  ]);

  if (offeringResult.error) throw new Error(`Unable to load offered units: ${offeringResult.error.message}`);
  if (registrationResult.error) throw new Error(`Unable to load selected units: ${registrationResult.error.message}`);
  if (submissionResult.error) throw new Error(`Unable to load registration status: ${submissionResult.error.message}`);
  if (stageResult.error) throw new Error(`Unable to load programme stages: ${stageResult.error.message}`);
  if (stageUnitResult.error) throw new Error(`Unable to load stage units: ${stageUnitResult.error.message}`);
  if (programmeUnitsResult.error) throw new Error(`Unable to load programme units: ${programmeUnitsResult.error.message}`);

  const stagesById = new Map((stageResult.data ?? []).map((s) => [s.id, s]));
  const stageByUnitId = new Map<string, { stageId: string; stageName: string; stageCode: string; sequenceNumber: number }>();
  for (const su of stageUnitResult.data ?? []) {
    const s = stagesById.get(su.stage_id);
    if (s) {
      stageByUnitId.set(su.unit_id, {
        stageId: s.id,
        stageName: s.name,
        stageCode: s.code,
        sequenceNumber: s.sequence_number,
      });
    }
  }

  const selected = new Set((registrationResult.data ?? []).map((row) => row.unit_id));
  const cohort = Array.isArray(student.current_cohort) ? student.current_cohort[0] : student.current_cohort;
  const effectiveStageId = student.current_stage_id || cohort?.current_stage_id || null;

  const stageUnitIds = new Set(
    (stageUnitResult.data ?? [])
      .filter((row) => row.stage_id === effectiveStageId)
      .map((row) => row.unit_id),
  );
  const hasConfiguredStage = Boolean(effectiveStageId && stageUnitIds.size > 0);

  // Map of unit offerings in the active period for the student's programme
  const offeredCohortUnitIds = new Set<string>();
  const offeredProgrammeUnitIds = new Set<string>();

  for (const offering of offeringResult.data ?? []) {
    const unit = Array.isArray(offering.unit) ? offering.unit[0] : offering.unit;
    if (!unit || unit.programme_id !== student.programme_id) continue;
    offeredProgrammeUnitIds.add(unit.id);
    if (offering.cohort_id === student.current_cohort_id) {
      offeredCohortUnitIds.add(unit.id);
    }
  }

  // Collect all available units from programme curriculum & offerings
  const unitsMap = new Map<string, DepartmentRegistrationUnit>();

  for (const unit of programmeUnitsResult.data ?? []) {
    const stageInfo = stageByUnitId.get(unit.id);
    const isExpected = hasConfiguredStage
      ? stageUnitIds.has(unit.id)
      : offeredCohortUnitIds.has(unit.id);

    const isOfferedInTerm = offeredProgrammeUnitIds.has(unit.id);
    const category: 'expected' | 'offered' | 'curriculum' = isExpected
      ? 'expected'
      : isOfferedInTerm
        ? 'offered'
        : 'curriculum';

    unitsMap.set(unit.id, {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      isExpected,
      isSelected: selected.size > 0 ? selected.has(unit.id) : isExpected,
      category,
      stageName: stageInfo?.stageName ?? (unit.academic_period_number ? `Semester ${unit.academic_period_number}` : null),
      stageCode: stageInfo?.stageCode ?? (unit.academic_period_number ? `S${unit.academic_period_number}` : null),
    });
  }

  const programme = Array.isArray(student.programme) ? student.programme[0] : student.programme;
  const currentStage = Array.isArray(student.current_stage) ? student.current_stage[0] : student.current_stage;

  const categoryRank: Record<string, number> = {
    expected: 0,
    offered: 1,
    curriculum: 2,
  };

  const sortedUnits = [...unitsMap.values()].sort((a, b) => {
    const rankA = categoryRank[a.category ?? 'curriculum'];
    const rankB = categoryRank[b.category ?? 'curriculum'];
    if (rankA !== rankB) return rankA - rankB;

    const seqA = stageByUnitId.get(a.id)?.sequenceNumber ?? 99;
    const seqB = stageByUnitId.get(b.id)?.sequenceNumber ?? 99;
    if (seqA !== seqB) return seqA - seqB;

    return a.code.localeCompare(b.code);
  });

  return {
    period: { id: period.id, code: period.code, name: period.name },
    student: {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode: programme?.code ?? '-',
      cohortName: cohort?.name ?? '-',
      currentStageId: student.current_stage_id,
      currentStageName: currentStage?.name ?? null,
    },
    stageOptions: (stageResult.data ?? []).map((stage) => ({
      id: stage.id,
      code: stage.code,
      name: stage.name,
      sequenceNumber: stage.sequence_number,
    })),
    units: sortedUnits,
    existingStatus: submissionResult.data?.status ?? 'not_submitted',
    existingNote:
      submissionResult.data?.verification_note ??
      submissionResult.data?.exception_reason ??
      null,
  };
}


export async function getProgrammeStageSetups(): Promise<ProgrammeStageSetup[]> {
  const supabase = await createClient();

  const [programmeResult, stageResult, stageUnitResult, unitResult] = await Promise.all([
    supabase.from('programmes').select('id, code, name').order('code', { ascending: true }),
    supabase
      .from('programme_stages')
      .select('id, programme_id, name, code, sequence_number')
      .eq('is_active', true)
      .order('sequence_number', { ascending: true }),
    supabase.from('programme_stage_units').select('stage_id, unit_id'),
    supabase.from('units').select('id, code, name, programme_id').order('name', { ascending: true }),
  ]);

  if (programmeResult.error) throw new Error(`Unable to load programmes: ${programmeResult.error.message}`);
  if (stageResult.error) throw new Error(`Unable to load stages: ${stageResult.error.message}`);
  if (stageUnitResult.error) throw new Error(`Unable to load stage units: ${stageUnitResult.error.message}`);
  if (unitResult.error) throw new Error(`Unable to load units: ${unitResult.error.message}`);

  return (programmeResult.data ?? []).map((programme) => {
    const stages = (stageResult.data ?? [])
      .filter((stage) => stage.programme_id === programme.id)
      .map((stage) => ({
        id: stage.id,
        code: stage.code,
        name: stage.name,
        sequenceNumber: stage.sequence_number,
        unitIds: (stageUnitResult.data ?? [])
          .filter((row) => row.stage_id === stage.id)
          .map((row) => row.unit_id),
      }));

    const units = (unitResult.data ?? [])
      .filter((unit) => unit.programme_id === programme.id)
      .map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

    return {
      programmeId: programme.id,
      programmeCode: programme.code,
      programmeName: programme.name,
      stages,
      units,
    };
  });
}
