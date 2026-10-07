import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';

type UnknownRow = Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function asNumber(
  value: unknown,
): number | null {
  return typeof value === 'number'
    ? value
    : null;
}

function relationRow(
  value: unknown,
): UnknownRow | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as UnknownRow;
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value[0] &&
    typeof value[0] === 'object'
  ) {
    return value[0] as UnknownRow;
  }

  return null;
}

export interface AssessmentPopulationStudent {
  populationId: string;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus:
    | 'expected'
    | 'absent';
  registrationStatus: string | null;
  cohortId?: string;
  cohortName?: string;
}

export interface AssessmentPopulationWorkspace {
  assessmentId: string;
  assessmentType:
    | 'cat'
    | 'exam'
    | null;
  workflowStatus: string | null;
  populationGeneratedAt: string | null;
  populationLockedAt: string | null;
  unit: {
    id: string;
    code: string | null;
    name: string;
  };
  cohort: {
    id: string;
    name: string;
  } | null;
  academicPeriod: {
    id: string;
    code: string | null;
    name: string;
  };
  registeredPopulation: number;
  expectedToSit: number;
  markedAbsent: number;
  students: AssessmentPopulationStudent[];
}

export const getAllocationPopulationWorkspace = cache(
  async (allocationId: string): Promise<AssessmentPopulationWorkspace> => {
    const supabase = createAdminClient();

    const { data: alloc, error: allocErr } = await supabase
      .from('teaching_allocations')
      .select(`
        id,
        academic_period_id,
        cohort_id,
        unit_id,
        unit:units(id, code, name),
        cohort:cohorts(id, name),
        period:academic_periods(id, code, name)
      `)
      .eq('id', allocationId)
      .maybeSingle();

    if (allocErr || !alloc) {
      throw new Error('Teaching allocation was not found.');
    }

    const unit = Array.isArray(alloc.unit) ? alloc.unit[0] : alloc.unit;
    const cohort = Array.isArray(alloc.cohort) ? alloc.cohort[0] : alloc.cohort;
    const period = Array.isArray(alloc.period) ? alloc.period[0] : alloc.period;

    // Allocation documents and allocation-level marks use the unified unit
    // roster across every cohort taking this unit.
    const roster = await getUnifiedUnitRoster({
      supabase,
      allocationId: alloc.id,
      unitId: alloc.unit_id,
      academicPeriodId: alloc.academic_period_id,
    });

    const students: AssessmentPopulationStudent[] = roster.students.map((st) => ({
      populationId: st.studentId,
      studentId: st.studentId,
      admissionNumber: st.admissionNumber,
      fullName: st.fullName,
      attendanceStatus: st.attendanceStatus,
      registrationStatus: st.registrationStatus,
      cohortId: st.cohortId,
      cohortName: st.cohortName,
    }));

    // Look up or provision the authoritative assessment event for this allocation
    let resolvedAssessmentId = `alloc-${alloc.id}`;
    let resolvedWorkflowStatus = 'open';

    const { data: existingEvent } = await supabase
      .from('assessment_events')
      .select('id, operational_workflow_status')
      .eq('academic_period_id', alloc.academic_period_id)
      .eq('unit_id', alloc.unit_id)
      .eq('assessment_type', 'exam')
      .maybeSingle();

    if (existingEvent?.id) {
      resolvedAssessmentId = existingEvent.id;
      resolvedWorkflowStatus = (existingEvent.operational_workflow_status as string) || 'open';
    } else {
      const { data: provisionedId } = await supabase.rpc(
        'ensure_unit_markbook_ready',
        {
          p_academic_period_id: alloc.academic_period_id,
          p_unit_id: alloc.unit_id,
        },
      );
      if (provisionedId) {
        resolvedAssessmentId = provisionedId as string;
      }
    }

    return {
      assessmentId: resolvedAssessmentId,
      assessmentType: 'exam',
      workflowStatus: resolvedWorkflowStatus,
      populationGeneratedAt: null,
      populationLockedAt: null,
      unit: {
        id: alloc.unit_id,
        code: unit?.code ?? null,
        name: unit?.name ?? 'Unit',
      },
      academicPeriod: {
        id: alloc.academic_period_id,
        code: period?.code ?? 'SEM',
        name: period?.name ?? 'Academic Period',
      },
      cohort: {
        id: alloc.cohort_id || (roster.cohortIds[0] ?? ''),
        name: roster.joinedCohortName || cohort?.name || 'Cohort',
      },
      students,
      registeredPopulation: students.length,
      expectedToSit: students.length,
      markedAbsent: 0,
    };
  }
);

export const getAssessmentPopulationWorkspace =
  cache(async (
    assessmentId: string,
  ): Promise<AssessmentPopulationWorkspace> => {
    if (assessmentId.startsWith('alloc-')) {
      const allocId = assessmentId.replace('alloc-', '');
      return getAllocationPopulationWorkspace(allocId);
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId);
    if (!isUUID) {
      throw new Error(`Invalid assessment identifier: "${assessmentId}"`);
    }

    const supabase = createAdminClient();

    const {
      data: eventData,
      error: eventError,
    } = await supabase
      .from('assessment_event_workspace')
      .select('*')
      .eq('id', assessmentId)
      .maybeSingle();

    if (eventError) {
      throw new Error(
        `Unable to load assessment: ${eventError.message}`,
      );
    }

    if (!eventData) {
      throw new Error(
        'Assessment was not found.',
      );
    }

    const event =
      eventData as UnknownRow;

    const periodId =
      asString(event.academic_period_id);

    const unitId =
      asString(event.unit_id);

    const cohortId =
      asString(event.cohort_id);

    if (!periodId || !unitId) {
      throw new Error(
        'Assessment is missing its Academic Period or unit.',
      );
    }

    const [
      periodResult,
      unitResult,
      cohortResult,
      populationResult,
    ] = await Promise.all([
      supabase
        .from('academic_periods')
        .select('id, code, name')
        .eq('id', periodId)
        .maybeSingle(),

      supabase
        .from('units')
        .select('id, code, name')
        .eq('id', unitId)
        .maybeSingle(),

      cohortId
        ? supabase
            .from('cohorts')
            .select('id, name')
            .eq('id', cohortId)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      supabase
        .from(
          'assessment_population_workspace_rows',
        )
        .select('*')
        .eq('assessment_id', assessmentId),
    ]);

    const error =
      periodResult.error ??
      unitResult.error ??
      cohortResult.error ??
      populationResult.error;

    if (error) {
      throw new Error(
        `Unable to load assessment population: ${error.message}`,
      );
    }

    if (
      !periodResult.data ||
      !unitResult.data
    ) {
      throw new Error(
        'Assessment reference data is incomplete.',
      );
    }

    const populationRows =
      (populationResult.data ??
        []) as UnknownRow[];

    const populationByStudentId = new Map(
      populationRows.map((row) => [
        asString(row.student_id) ?? '',
        row,
      ]),
    );

    // Discover authoritative roster across all cohorts taking this unit
    const roster = await getUnifiedUnitRoster({
      supabase,
      unitId,
      academicPeriodId: periodId,
    });

    const discoveredCohortName =
      roster.joinedCohortName ||
      (cohortResult.data ? cohortResult.data.name : null);

    const candidateStudentIds = new Set(
      roster.students.map((st) => st.studentId),
    );

    // Identify any students in workspace rows that were not in unified roster
    const extraStudentIds = populationRows
      .map((row) => asString(row.student_id))
      .filter((id): id is string => Boolean(id) && !candidateStudentIds.has(id));

    let extraStudentRows: UnknownRow[] = [];
    if (extraStudentIds.length > 0) {
      const { data: extraStudents } = await supabase
        .from('students')
        .select('id, admission_number, full_name, current_cohort_id, cohort:cohorts(id, name)')
        .in('id', extraStudentIds);
      extraStudentRows = (extraStudents ?? []) as UnknownRow[];
    }

    const extraStudentById = new Map(
      extraStudentRows.map((st) => [asString(st.id) ?? '', st]),
    );

    const mergedStudents: AssessmentPopulationStudent[] = [];

    // 1. Add all students discovered across all taking cohorts
    for (const st of roster.students) {
      const popRow = populationByStudentId.get(st.studentId);
      const attendance =
        popRow && asString(popRow.attendance_status) === 'absent'
          ? 'absent'
          : st.attendanceStatus === 'absent'
            ? 'absent'
            : 'expected';

      mergedStudents.push({
        populationId: (popRow ? asString(popRow.id) : null) ?? st.studentId,
        studentId: st.studentId,
        admissionNumber: st.admissionNumber,
        fullName: st.fullName,
        attendanceStatus: attendance,
        registrationStatus:
          (popRow ? asString(popRow.snapshot_registration_status) : null) ??
          st.registrationStatus,
        cohortId: st.cohortId,
        cohortName: st.cohortName,
      });
    }

    // 2. Add any extra students from population rows
    for (const extraId of extraStudentIds) {
      const extra = extraStudentById.get(extraId);
      if (!extra) continue;
      const popRow = populationByStudentId.get(extraId);
      const cohortObj = relationRow(extra.cohort);

      mergedStudents.push({
        populationId: (popRow ? asString(popRow.id) : null) ?? extraId,
        studentId: extraId,
        admissionNumber: asString(extra.admission_number) ?? '—',
        fullName: asString(extra.full_name) ?? 'Student',
        attendanceStatus:
          popRow && asString(popRow.attendance_status) === 'absent'
            ? 'absent'
            : 'expected',
        registrationStatus: popRow
          ? asString(popRow.snapshot_registration_status)
          : 'registered',
        cohortId: asString(extra.current_cohort_id) ?? undefined,
        cohortName: cohortObj ? asString(cohortObj.name) ?? undefined : undefined,
      });
    }

    // Sort by cohort name, then naturally by admission number
    const students = mergedStudents.sort((first, second) => {
      const cohortComparison = (first.cohortName || '').localeCompare(second.cohortName || '');
      if (cohortComparison !== 0) return cohortComparison;
      return compareAdmissionNumbers(first.admissionNumber, second.admissionNumber);
    });

    const markedAbsent =
      students.filter(
        (student) =>
          student.attendanceStatus ===
          'absent',
      ).length;

    const registeredPopulation =
      students.length;

    return {
      assessmentId,
      assessmentType:
        asString(
          event.assessment_type,
        ) === 'cat'
          ? 'cat'
          : asString(
                event.assessment_type,
              ) === 'exam'
            ? 'exam'
            : null,
      workflowStatus:
        asString(
          event.workflow_status,
        ),
      populationGeneratedAt:
        asString(
          event.population_generated_at,
        ),
      populationLockedAt:
        asString(
          event.population_locked_at,
        ),
      unit: {
        id: unitResult.data.id,
        code:
          unitResult.data.code ??
          null,
        name:
          unitResult.data.name,
      },
      cohort:
        cohortResult.data
          ? {
              id:
                cohortResult.data.id,
              name:
                discoveredCohortName || cohortResult.data.name,
            }
          : discoveredCohortName
            ? {
                id: '',
                name: discoveredCohortName,
              }
            : null,
      academicPeriod: {
        id: periodResult.data.id,
        code:
          periodResult.data.code ??
          null,
        name:
          periodResult.data.name,
      },
      registeredPopulation,
      expectedToSit:
        registeredPopulation -
        markedAbsent,
      markedAbsent,
      students,
    };
  });
