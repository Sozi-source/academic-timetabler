import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';

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
    const supabase = await createClient();

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

    // Allocation documents and allocation-level marks use the live unit
    // registration roster across every cohort taking this unit.
    const reportingResult = await (supabase as any)
      .from('student_period_reporting')
      .select('student_id')
      .eq('academic_period_id', alloc.academic_period_id)
      .eq('reporting_status', 'reported');

    const reportedStudentIds = ((reportingResult.data ?? []) as Array<{
      student_id: string;
    }>).map((row) => row.student_id);

    let regStudents: Array<{
      student_id: string;
      student: Array<{
        id: string;
        admission_number: string | null;
        full_name: string | null;
      }> | {
        id: string;
        admission_number: string | null;
        full_name: string | null;
      } | null;
    }> | null = [];

    if (reportingResult.error || reportedStudentIds.length > 0) {
      let registrationQuery = supabase
        .from('student_unit_registrations')
        .select('student_id, student:students(id, admission_number, full_name)')
        .eq('academic_period_id', alloc.academic_period_id)
        .eq('unit_id', alloc.unit_id)
        .eq('registration_status', 'registered');

      if (!reportingResult.error) {
        registrationQuery = registrationQuery.in('student_id', reportedStudentIds);
      }

      const registrationResult = await registrationQuery;
      regStudents = registrationResult.data;
    }

    const students: AssessmentPopulationStudent[] = [];

    if (regStudents && regStudents.length > 0) {
      for (const reg of regStudents) {
        const st = Array.isArray(reg.student) ? reg.student[0] : reg.student;
        if (st?.id) {
          students.push({
            populationId: st.id,
            studentId: st.id,
            admissionNumber: st.admission_number ?? '—',
            fullName: st.full_name ?? 'Student',
            attendanceStatus: 'expected',
            registrationStatus: 'registered',
          });
        }
      }
    } else if (reportingResult.error && alloc.cohort_id) {
      const { data: cohortStudents } = await supabase
        .from('students')
        .select('id, admission_number, full_name')
        .eq('current_cohort_id', alloc.cohort_id)
        .in('lifecycle_status', ['admitted', 'active']);

      if (cohortStudents) {
        for (const st of cohortStudents) {
          students.push({
            populationId: st.id,
            studentId: st.id,
            admissionNumber: st.admission_number ?? '—',
            fullName: st.full_name ?? 'Student',
            attendanceStatus: 'expected',
            registrationStatus: 'enrolled',
          });
        }
      }
    }

    students.sort((first, second) =>
      compareAdmissionNumbers(first.admissionNumber, second.admissionNumber),
    );

    return {
      assessmentId: `alloc-${alloc.id}`,
      assessmentType: 'exam',
      workflowStatus: 'draft',
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
      cohort: cohort
        ? {
            id: cohort.id,
            name: cohort.name,
          }
        : null,
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

    const supabase = await createClient();

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

    const studentIds = [
      ...new Set(
        populationRows
          .map((row) =>
            asString(row.student_id),
          )
          .filter(
            (value): value is string =>
              Boolean(value),
          ),
      ),
    ];

    let studentRows: UnknownRow[] = [];

    if (studentIds.length > 0) {
      const {
        data,
        error: studentsError,
      } = await supabase
        .from('students')
        .select(
          'id, admission_number, full_name',
        )
        .in('id', studentIds);

      if (studentsError) {
        throw new Error(
          `Unable to load assessment students: ${studentsError.message}`,
        );
      }

      studentRows =
        (data ?? []) as UnknownRow[];
    } else {
      // Auto-discovery fallback: fetch students directly from registrations or cohort
      const { data: regData } = await supabase
        .from('student_unit_registrations')
        .select('student_id, student:students(id, admission_number, full_name)')
        .eq('academic_period_id', periodId)
        .eq('unit_id', unitId)
        .eq('registration_status', 'registered');

      if (regData && regData.length > 0) {
        for (const reg of regData) {
          const st = Array.isArray(reg.student) ? reg.student[0] : reg.student;
          if (st?.id) {
            studentRows.push(st as UnknownRow);
            populationRows.push({
              id: st.id,
              student_id: st.id,
              attendance_status: 'expected',
              registration_status: 'registered',
            });
          }
        }
      } else if (cohortId) {
        const { data: cohortStudents } = await supabase
          .from('students')
          .select('id, admission_number, full_name')
          .eq('current_cohort_id', cohortId)
          .in('lifecycle_status', ['admitted', 'active']);

        if (cohortStudents) {
          for (const st of cohortStudents) {
            studentRows.push(st as UnknownRow);
            populationRows.push({
              id: st.id,
              student_id: st.id,
              attendance_status: 'expected',
              registration_status: 'enrolled',
            });
          }
        }
      }
    }

    const studentById = new Map(
      studentRows.map((student) => [
        asString(student.id) ?? '',
        student,
      ]),
    );

    const students =
      populationRows
        .map((population) => {
          const studentId =
            asString(
              population.student_id,
            );

          if (!studentId) {
            return null;
          }

          const student =
            studentById.get(studentId);

          if (!student) {
            return null;
          }

          const attendance =
            asString(
              population.attendance_status,
            ) === 'absent'
              ? 'absent'
              : 'expected';

          return {
            populationId:
              asString(population.id) ??
              studentId,
            studentId,
            admissionNumber:
              asString(
                student.admission_number,
              ) ?? 'â€”',
            fullName:
              asString(
                student.full_name,
              ) ?? 'Student',
            attendanceStatus:
              attendance,
            registrationStatus:
              asString(
                population
                  .snapshot_registration_status,
              ),
          } satisfies
            AssessmentPopulationStudent;
        })
        .filter(
          (
            student,
          ): student is
            AssessmentPopulationStudent =>
            student !== null,
        )
        .sort((first, second) =>
          compareAdmissionNumbers(
            first.admissionNumber,
            second.admissionNumber,
          ),
        );

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
                cohortResult.data.name,
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
