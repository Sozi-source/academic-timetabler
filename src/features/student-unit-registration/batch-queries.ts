import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  BatchRegistrationContext,
} from './batch-types';

export async function getBatchRegistrationContext(): Promise<BatchRegistrationContext> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return {
      period: null,
      cohorts: [],
      students: [],
      units: [],
    };
  }

  const supabase = await createClient();

  const { data: period, error: periodError } = await supabase
    .from('academic_periods')
    .select('id, code, name')
    .eq('status', 'active')
    .maybeSingle();

  if (periodError) {
    throw new Error(
      `Unable to load active academic period: ${periodError.message}`,
    );
  }

  const { data: programmes, error: programmeError } = await supabase
    .from('programmes')
    .select('id, code')
    .eq('department_id', profile.activeDepartmentId)
    .eq('is_active', true);

  if (programmeError) {
    throw new Error(
      `Unable to load programmes: ${programmeError.message}`,
    );
  }

  const programmeIds = (programmes ?? []).map((programme) => programme.id);
  const programmeCode = new Map(
    (programmes ?? []).map((programme) => [
      programme.id,
      programme.code,
    ]),
  );

  if (programmeIds.length === 0) {
    return {
      period: period
        ? { id: period.id, code: period.code, name: period.name }
        : null,
      cohorts: [],
      students: [],
      units: [],
    };
  }

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      admission_number,
      full_name,
      programme_id,
      current_cohort_id,
      current_stage_id,
      lifecycle_status,
      current_cohort:cohorts!students_current_cohort_id_fkey(
        id,
        name,
        current_stage_id,
        current_stage:programme_stages!cohorts_current_stage_id_fkey(id, code, name, sequence_number)
      ),
      current_stage:programme_stages!students_current_stage_id_fkey(id, code, name, sequence_number)
    `)
    .in('programme_id', programmeIds)
    .in('lifecycle_status', ['admitted', 'active', 'deferred', 'dropped_out'])
    .order('full_name', { ascending: true });

  if (studentError) {
    throw new Error(
      `Unable to load students: ${studentError.message}`,
    );
  }

  const cohortIds = [
    ...new Set(
      (students ?? [])
        .map((student) => student.current_cohort_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [stageUnitResult, offeringResult, allStageResult, unitResult] = await Promise.all([
    supabase
      .from('programme_stage_units')
      .select('stage_id, unit_id'),
    period && cohortIds.length > 0
      ? supabase
          .from('unit_offerings')
          .select('cohort_id, unit_id')
          .eq('academic_period_id', period.id)
          .eq('selection_state', 'included')
          .neq('status', 'cancelled')
          .in('cohort_id', cohortIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('programme_stages')
      .select('id, name, sequence_number')
      .in('programme_id', programmeIds),
    supabase
      .from('units')
      .select('id, code, name, programme_id, academic_period_number')
      .in('programme_id', programmeIds)
      .eq('is_active', true)
      .order('code', { ascending: true }),
  ]);

  if (stageUnitResult.error) {
    throw new Error(
      `Unable to load stage units: ${stageUnitResult.error.message}`,
    );
  }

  if (offeringResult.error) {
    throw new Error(
      `Unable to load units on offer: ${offeringResult.error.message}`,
    );
  }

  if (allStageResult.error || unitResult.error) {
    throw new Error(
      `Unable to load override units: ${allStageResult.error?.message ?? unitResult.error?.message}`,
    );
  }

  const reportingResult = period
    ? await (supabase as any)
        .from('student_period_reporting')
        .select('student_id, reporting_status')
        .eq('academic_period_id', period.id)
    : { data: [], error: null };

  const reportingByStudent = new Map<string, string>(
    ((reportingResult.data ?? []) as Array<{
      student_id: string;
      reporting_status: string;
    }>).map((row) => [row.student_id, row.reporting_status]),
  );

  const unitsByStage = new Map<string, Set<string>>();

  for (const row of stageUnitResult.data ?? []) {
    const set = unitsByStage.get(row.stage_id) ?? new Set<string>();
    set.add(row.unit_id);
    unitsByStage.set(row.stage_id, set);
  }

  const unitsByCohort = new Map<string, Set<string>>();

  for (const row of offeringResult.data ?? []) {
    const set = unitsByCohort.get(row.cohort_id) ?? new Set<string>();
    set.add(row.unit_id);
    unitsByCohort.set(row.cohort_id, set);
  }

  const mappedStudents = (students ?? []).map((student) => {
    const cohort = Array.isArray(student.current_cohort)
      ? student.current_cohort[0]
      : student.current_cohort;

    const stage = Array.isArray(student.current_stage)
      ? student.current_stage[0]
      : student.current_stage;

    const cohortStage = Array.isArray((cohort as any)?.current_stage)
      ? (cohort as any)?.current_stage[0]
      : (cohort as any)?.current_stage;

    const effectiveStageId =
      student.current_stage_id || cohort?.current_stage_id || null;
    const effectiveStage = stage || cohortStage || null;

    const stageUnits = effectiveStageId
      ? unitsByStage.get(effectiveStageId) ?? new Set<string>()
      : new Set<string>();

    const offeredUnits = student.current_cohort_id
      ? unitsByCohort.get(student.current_cohort_id) ?? new Set<string>()
      : new Set<string>();

    const expectedUnits = [...stageUnits].filter((unitId) =>
      offeredUnits.has(unitId),
    ).length;

    const hasStage = Boolean(effectiveStageId);
    const hasStageUnits = stageUnits.size > 0;
    const hasMatchingOfferings = expectedUnits > 0;
    const lifecycleEligible = ['admitted', 'active'].includes(
      student.lifecycle_status,
    );

    const eligibilityReason:
      | 'ready'
      | 'no_stage'
      | 'no_stage_units'
      | 'no_units_on_offer' =
      !hasStage
        ? 'no_stage'
        : !hasStageUnits
          ? 'no_stage_units'
          : !hasMatchingOfferings
            ? 'no_units_on_offer'
            : 'ready';

    return {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode:
        programmeCode.get(student.programme_id) ?? '-',
      cohortId: student.current_cohort_id,
      cohortName: cohort?.name ?? null,
      stageId: effectiveStageId,
      stageCode: effectiveStage?.code ?? null,
      lifecycleStatus: student.lifecycle_status,
      reportingStatus: (
        student.lifecycle_status === 'deferred'
          ? 'deferred'
          : student.lifecycle_status === 'dropped_out'
            ? 'dropped_out'
            : reportingByStudent.get(student.id) ?? 'pending'
      ) as 'pending' | 'reported' | 'deferred' | 'dropped_out',
      expectedUnits,
      canRegister: lifecycleEligible && Boolean(student.current_cohort_id),
      eligible:
        lifecycleEligible &&
        Boolean(student.current_cohort_id) &&
        eligibilityReason === 'ready',
      eligibilityReason,
    };
  });

  const cohortMap = new Map<
    string,
    {
      id: string;
      name: string;
      studentCount: number;
    }
  >();

  for (const student of mappedStudents) {
    if (!student.cohortId || !student.cohortName) continue;

    const current = cohortMap.get(student.cohortId);

    cohortMap.set(student.cohortId, {
      id: student.cohortId,
      name: student.cohortName,
      studentCount: (current?.studentCount ?? 0) + 1,
    });
  }

  return {
    period: period
      ? { id: period.id, code: period.code, name: period.name }
      : null,
    cohorts: [...cohortMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    students: mappedStudents,
    units: (unitResult.data ?? []).map((unit) => {
      const stageUnit = (stageUnitResult.data ?? []).find(
        (binding) => binding.unit_id === unit.id,
      );
      const stage = (allStageResult.data ?? []).find(
        (item) => item.id === stageUnit?.stage_id,
      );

      return {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        programmeCode: programmeCode.get(unit.programme_id) ?? '-',
        stageName: stage?.name ?? (unit.academic_period_number ? `Semester ${unit.academic_period_number}` : null),
      };
    }),
  };
}
