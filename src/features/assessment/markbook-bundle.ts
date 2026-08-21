import {
  createClient,
} from '@/lib/supabase/server';

import type {
  AssessmentMarkbookBundle,
  AssessmentMarkbookCohort,
} from './markbook-generator';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

export async function loadAssessmentMarkbookBundle({
  rootAssessmentId,
  generationId,
  generatedAt,
}: {
  rootAssessmentId: string;
  generationId: string;
  generatedAt: Date;
}): Promise<AssessmentMarkbookBundle> {
  const supabase =
    await createClient();

  const {
    data: rootData,
    error: rootError,
  } = await supabase
    .from(
      'assessment_event_workspace',
    )
    .select('*')
    .eq(
      'id',
      rootAssessmentId,
    )
    .maybeSingle();

  if (rootError) {
    throw new Error(
      `Unable to load assessment: ${rootError.message}`,
    );
  }

  if (!rootData) {
    throw new Error(
      'Assessment was not found.',
    );
  }

  const root =
    rootData as UnknownRow;

  const periodId =
    asString(
      root.academic_period_id,
    );

  const unitId =
    asString(
      root.unit_id,
    );

  const assessmentType =
    asString(
      root.assessment_type,
    );

  if (
    !periodId ||
    !unitId ||
    (
      assessmentType !==
        'cat' &&
      assessmentType !==
        'exam'
    )
  ) {
    throw new Error(
      'Assessment is missing its Academic Period, unit or CAT/Exam type.',
    );
  }

  const {
    data: eventData,
    error: eventError,
  } = await supabase
    .from(
      'assessment_event_workspace',
    )
    .select('*')
    .eq(
      'academic_period_id',
      periodId,
    )
    .eq(
      'unit_id',
      unitId,
    )
    .eq(
      'assessment_type',
      assessmentType,
    );

  if (eventError) {
    throw new Error(
      `Unable to load assessment bundle: ${eventError.message}`,
    );
  }

  const eventRows =
    (eventData ??
      []) as UnknownRow[];

  const eventIds =
    eventRows
      .map(
        (event) =>
          asString(
            event.id,
          ),
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      );

  if (
    eventIds.length === 0
  ) {
    throw new Error(
      'No assessment events are available for this unit.',
    );
  }

  const [
    rosterResult,
    periodResult,
    unitResult,
  ] = await Promise.all([
    supabase
      .from(
        'assessment_population_workspace_rows',
      )
      .select('*')
      .in(
        'assessment_id',
        eventIds,
      ),

    supabase
      .from(
        'academic_periods',
      )
      .select(
        'id, code, name',
      )
      .eq(
        'id',
        periodId,
      )
      .maybeSingle(),

    supabase
      .from('units')
      .select(
        'id, code, name',
      )
      .eq(
        'id',
        unitId,
      )
      .maybeSingle(),
  ]);

  const error =
    rosterResult.error ??
    periodResult.error ??
    unitResult.error;

  if (error) {
    throw new Error(
      `Unable to prepare markbook: ${error.message}`,
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

  const rosterRows =
    (
      rosterResult.data ??
      []
    ) as UnknownRow[];

  if (
    rosterRows.length === 0
  ) {
    throw new Error(
      'Generate the assessment population before downloading the markbook.',
    );
  }

  const studentIds =
    [
      ...new Set(
        rosterRows
          .map(
            (row) =>
              asString(
                row.student_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      ),
    ];

  const cohortIds =
    [
      ...new Set(
        rosterRows
          .map(
            (row) =>
              asString(
                row.cohort_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      ),
    ];

  const [
    studentsResult,
    cohortsResult,
  ] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from(
            'students',
          )
          .select(
            'id, admission_number, full_name',
          )
          .in(
            'id',
            studentIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    cohortIds.length > 0
      ? supabase
          .from(
            'cohorts',
          )
          .select(
            'id, name',
          )
          .in(
            'id',
            cohortIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (
    studentsResult.error
  ) {
    throw new Error(
      `Unable to load markbook students: ${studentsResult.error.message}`,
    );
  }

  if (
    cohortsResult.error
  ) {
    throw new Error(
      `Unable to load markbook cohorts: ${cohortsResult.error.message}`,
    );
  }

  const studentById =
    new Map(
      (
        studentsResult.data ??
        []
      ).map(
        (student) => [
          student.id,
          student,
        ],
      ),
    );

  const cohortById =
    new Map(
      (
        cohortsResult.data ??
        []
      ).map(
        (cohort) => [
          cohort.id,
          cohort,
        ],
      ),
    );

  const groups =
    new Map<
      string,
      AssessmentMarkbookCohort
    >();

  for (
    const row of rosterRows
  ) {
    const studentId =
      asString(
        row.student_id,
      );

    const assessmentId =
      asString(
        row.assessment_id,
      );

    if (
      !studentId ||
      !assessmentId
    ) {
      continue;
    }

    const student =
      studentById.get(
        studentId,
      );

    if (!student) {
      continue;
    }

    const cohortId =
      asString(
        row.cohort_id,
      );

    const groupKey =
      cohortId ??
      '__all__';

    const cohortName =
      cohortId
        ? (
            cohortById.get(
              cohortId,
            )?.name ??
            'Cohort'
          )
        : 'All Cohorts';

    const existing =
      groups.get(
        groupKey,
      );

    if (
      existing &&
      existing.assessmentId !==
        assessmentId
    ) {
      throw new Error(
        `Multiple assessment events exist for cohort ${cohortName}. Consolidate the duplicate assessment events before generating the workbook.`,
      );
    }

    const group =
      existing ?? {
        assessmentId,
        cohortId,
        cohortName,
        students: [],
      };

    group.students.push({
      studentId,
      admissionNumber:
        student.admission_number ??
        'â€”',
      fullName:
        student.full_name ??
        'Student',
      attendanceStatus:
        asString(
          row.attendance_status,
        ) === 'absent'
          ? 'absent'
          : 'expected',
    });

    groups.set(
      groupKey,
      group,
    );
  }

  const cohorts =
    [...groups.values()]
      .filter(
        (cohort) =>
          cohort.students.length >
          0,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.cohortName.localeCompare(
            second.cohortName,
          ),
      );

  if (
    cohorts.length === 0
  ) {
    throw new Error(
      'No valid students are available for the markbook.',
    );
  }

  return {
    generationId,
    rootAssessmentId,
    assessmentType,
    academicPeriod: {
      id:
        periodResult.data.id,
      code:
        periodResult.data.code ??
        null,
      name:
        periodResult.data.name,
    },
    unit: {
      id:
        unitResult.data.id,
      code:
        unitResult.data.code ??
        null,
      name:
        unitResult.data.name,
    },
    cohorts,
    generatedAt,
  };
}
