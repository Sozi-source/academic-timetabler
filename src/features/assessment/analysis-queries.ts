import 'server-only';

import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import {
  calculateAssessmentAnalysis,
  deriveAssessmentBundleStatus,
  type AssessmentAnalysisResultRow,
  type AssessmentAnalysisSummary,
} from './analysis-engine';

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

function asNumber(
  value: unknown,
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      'string' &&
    value.trim() !==
      ''
  ) {
    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

export interface AssessmentAnalysisBundleListItem {
  rootAssessmentId: string;
  academicPeriodId: string;
  academicPeriodName: string;
  unitId: string;
  unitName: string;
  assessmentType:
    | 'cat'
    | 'exam';
  cohortCount: number;
  status: string;
  summary: AssessmentAnalysisSummary;
}

export interface AssessmentAnalysisStudentRow {
  resultId: string | null;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string | null;
  cohortName: string;
  status: string;
  mark: number | null;
}

export interface AssessmentAnalysisCohortRow {
  cohortId: string | null;
  cohortName: string;
  assessmentIds: string[];
  summary: AssessmentAnalysisSummary;
}

export interface AssessmentAnalysisDetail {
  rootAssessmentId: string;
  academicPeriodId: string;
  academicPeriodName: string;
  unitId: string;
  unitName: string;
  assessmentType:
    | 'cat'
    | 'exam';
  status: string;
  assessmentIds: string[];
  summary: AssessmentAnalysisSummary;
  cohorts: AssessmentAnalysisCohortRow[];
  students: AssessmentAnalysisStudentRow[];
}

interface EventWorkspaceRow {
  id: string;
  academicPeriodId: string;
  cohortId: string | null;
  unitId: string;
  assessmentType:
    | 'cat'
    | 'exam';
  workflowStatus: string | null;
}

function mapEvent(
  row: UnknownRow,
): EventWorkspaceRow | null {
  const id =
    asString(
      row.id,
    );

  const academicPeriodId =
    asString(
      row.academic_period_id,
    );

  const unitId =
    asString(
      row.unit_id,
    );

  const rawType =
    asString(
      row.assessment_type,
    );

  if (
    !id ||
    !academicPeriodId ||
    !unitId ||
    (
      rawType !==
        'cat' &&
      rawType !==
        'exam'
    )
  ) {
    return null;
  }

  return {
    id,
    academicPeriodId,
    cohortId:
      asString(
        row.cohort_id,
      ),
    unitId,
    assessmentType:
      rawType,
    workflowStatus:
      asString(
        row.workflow_status,
      ),
  };
}

function bundleKey(
  event: EventWorkspaceRow,
): string {
  return [
    event.academicPeriodId,
    event.unitId,
    event.assessmentType,
  ].join(
    ':',
  );
}

function mapAnalysisResult(
  row: UnknownRow,
): AssessmentAnalysisResultRow | null {
  const assessmentId =
    asString(
      row.assessment_event_id,
    );

  const studentId =
    asString(
      row.student_id,
    );

  if (
    !assessmentId ||
    !studentId
  ) {
    return null;
  }

  return {
    assessmentId,
    studentId,
    cohortId:
      asString(
        row.cohort_id,
      ),
    status:
      asString(
        row.operational_result_status,
      ) ??
      'pending',
    mark:
      asNumber(
        row.operational_mark,
      ),
  };
}

async function loadOperationalAnalysisData() {
  const supabase =
    await createClient();

  const {
    data: eventData,
    error: eventError,
  } = await supabase
    .from(
      'assessment_event_workspace',
    )
    .select(
      'id, academic_period_id, cohort_id, unit_id, assessment_type, workflow_status',
    )
    .in(
      'assessment_type',
      [
        'cat',
        'exam',
      ],
    );

  if (
    eventError
  ) {
    throw new Error(
      `Unable to load assessment events: ${eventError.message}`,
    );
  }

  const events =
    (
      eventData ??
      []
    )
      .map(
        (row) =>
          mapEvent(
            row as UnknownRow,
          ),
      )
      .filter(
        (
          row,
        ): row is EventWorkspaceRow =>
          row !==
          null,
      );

  if (
    events.length ===
    0
  ) {
    return {
      events: [],
      rosters: [],
      results: [],
      periods: [],
      units: [],
      cohorts: [],
    };
  }

  const eventIds =
    events.map(
      (event) =>
        event.id,
    );

  const periodIds =
    [
      ...new Set(
        events.map(
          (event) =>
            event.academicPeriodId,
        ),
      ),
    ];

  const unitIds =
    [
      ...new Set(
        events.map(
          (event) =>
            event.unitId,
        ),
      ),
    ];

  const cohortIds =
    [
      ...new Set(
        events
          .map(
            (event) =>
              event.cohortId,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    ];

  const [
    rosterResult,
    resultResult,
    periodResult,
    unitResult,
    cohortResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'assessment_roster',
        )
        .select(
          'id, assessment_id, student_id, cohort_id, pre_assessment_status',
        )
        .in(
          'assessment_id',
          eventIds,
        ),

      supabase
        .from(
          'assessment_results',
        )
        .select(
          'id, assessment_event_id, student_id, cohort_id, operational_result_status, operational_mark',
        )
        .in(
          'assessment_event_id',
          eventIds,
        )
        .not(
          'operational_result_status',
          'is',
          null,
        ),

      supabase
        .from(
          'academic_periods',
        )
        .select(
          'id, name',
        )
        .in(
          'id',
          periodIds,
        ),

      supabase
        .from(
          'units',
        )
        .select(
          'id, name',
        )
        .in(
          'id',
          unitIds,
        ),

      cohortIds.length >
      0
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
            data:
              [],
            error:
              null,
          }),
    ]);

  const error =
    rosterResult.error ??
    resultResult.error ??
    periodResult.error ??
    unitResult.error ??
    cohortResult.error;

  if (
    error
  ) {
    throw new Error(
      `Unable to load assessment analysis data: ${error.message}`,
    );
  }

  return {
    events,
    rosters:
      (
        rosterResult.data ??
        []
      ) as UnknownRow[],
    results:
      (
        resultResult.data ??
        []
      ) as UnknownRow[],
    periods:
      (
        periodResult.data ??
        []
      ) as UnknownRow[],
    units:
      (
        unitResult.data ??
        []
      ) as UnknownRow[],
    cohorts:
      (
        cohortResult.data ??
        []
      ) as UnknownRow[],
  };
}

export const getAssessmentAnalysisBundles =
  cache(async (): Promise<
    AssessmentAnalysisBundleListItem[]
  > => {
    const data =
      await loadOperationalAnalysisData();

    const periodById =
      new Map(
        data.periods.map(
          (row) => [
            asString(
              row.id,
            ) ??
              '',
            asString(
              row.name,
            ) ??
              'Academic Period',
          ],
        ),
      );

    const unitById =
      new Map(
        data.units.map(
          (row) => [
            asString(
              row.id,
            ) ??
              '',
            asString(
              row.name,
            ) ??
              'Unit',
          ],
        ),
      );

    const eventGroups =
      new Map<
        string,
        EventWorkspaceRow[]
      >();

    for (
      const event of
        data.events
    ) {
      const key =
        bundleKey(
          event,
        );

      const current =
        eventGroups.get(
          key,
        ) ??
        [];

      current.push(
        event,
      );

      eventGroups.set(
        key,
        current,
      );
    }

    const rosterByAssessment =
      new Map<
        string,
        UnknownRow[]
      >();

    for (
      const roster of
        data.rosters
    ) {
      const assessmentId =
        asString(
          roster.assessment_id,
        );

      if (!assessmentId) {
        continue;
      }

      const current =
        rosterByAssessment.get(
          assessmentId,
        ) ??
        [];

      current.push(
        roster,
      );

      rosterByAssessment.set(
        assessmentId,
        current,
      );
    }

    const resultsByAssessment =
      new Map<
        string,
        AssessmentAnalysisResultRow[]
      >();

    for (
      const rawResult of
        data.results
    ) {
      const result =
        mapAnalysisResult(
          rawResult,
        );

      if (!result) {
        continue;
      }

      const current =
        resultsByAssessment.get(
          result.assessmentId,
        ) ??
        [];

      current.push(
        result,
      );

      resultsByAssessment.set(
        result.assessmentId,
        current,
      );
    }

    const bundles:
      AssessmentAnalysisBundleListItem[] =
        [];

    for (
      const events of
        eventGroups.values()
    ) {
      const sorted =
        [...events].sort(
          (
            first,
            second,
          ) =>
            first.id.localeCompare(
              second.id,
            ),
        );

      const first =
        sorted[0];

      const assessmentIds =
        sorted.map(
          (event) =>
            event.id,
        );

      const registeredPopulation =
        assessmentIds.reduce(
          (
            total,
            assessmentId,
          ) =>
            total +
            (
              rosterByAssessment.get(
                assessmentId,
              )?.length ??
              0
            ),
          0,
        );

      const resultRows =
        assessmentIds.flatMap(
          (assessmentId) =>
            resultsByAssessment.get(
              assessmentId,
            ) ??
            [],
        );

      bundles.push({
        rootAssessmentId:
          first.id,
        academicPeriodId:
          first.academicPeriodId,
        academicPeriodName:
          periodById.get(
            first.academicPeriodId,
          ) ??
          'Academic Period',
        unitId:
          first.unitId,
        unitName:
          unitById.get(
            first.unitId,
          ) ??
          'Unit',
        assessmentType:
          first.assessmentType,
        cohortCount:
          new Set(
            sorted.map(
              (event) =>
                event.cohortId ??
                '__all__',
            ),
          ).size,
        status:
          deriveAssessmentBundleStatus(
            sorted.map(
              (event) =>
                event.workflowStatus,
            ),
          ),
        summary:
          calculateAssessmentAnalysis({
            registeredPopulation,
            rows:
              resultRows,
          }),
      });
    }

    return bundles.sort(
      (
        first,
        second,
      ) =>
        second.academicPeriodName.localeCompare(
          first.academicPeriodName,
        ) ||
        first.unitName.localeCompare(
          second.unitName,
        ) ||
        first.assessmentType.localeCompare(
          second.assessmentType,
        ),
    );
  });

export const getAssessmentAnalysisDetail =
  cache(async (
    rootAssessmentId: string,
  ): Promise<
    AssessmentAnalysisDetail | null
  > => {
    const supabase =
      await createClient();

    const {
      data: rootData,
      error: rootError,
    } = await supabase
      .from(
        'assessment_event_workspace',
      )
      .select(
        'id, academic_period_id, cohort_id, unit_id, assessment_type, workflow_status',
      )
      .eq(
        'id',
        rootAssessmentId,
      )
      .maybeSingle();

    if (
      rootError
    ) {
      throw new Error(
        `Unable to load assessment: ${rootError.message}`,
      );
    }

    if (!rootData) {
      return null;
    }

    const rootEvent =
      mapEvent(
        rootData as UnknownRow,
      );

    if (!rootEvent) {
      return null;
    }

    const {
      data: eventData,
      error: eventError,
    } = await supabase
      .from(
        'assessment_event_workspace',
      )
      .select(
        'id, academic_period_id, cohort_id, unit_id, assessment_type, workflow_status',
      )
      .eq(
        'academic_period_id',
        rootEvent.academicPeriodId,
      )
      .eq(
        'unit_id',
        rootEvent.unitId,
      )
      .eq(
        'assessment_type',
        rootEvent.assessmentType,
      );

    if (
      eventError
    ) {
      throw new Error(
        `Unable to load assessment bundle: ${eventError.message}`,
      );
    }

    const events =
      (
        eventData ??
        []
      )
        .map(
          (row) =>
            mapEvent(
              row as UnknownRow,
            ),
        )
        .filter(
          (
            row,
          ): row is EventWorkspaceRow =>
            row !==
            null,
        );

    const assessmentIds =
      events.map(
        (event) =>
          event.id,
      );

    if (
      assessmentIds.length ===
      0
    ) {
      return null;
    }

    const [
      rosterResult,
      resultResult,
      periodResult,
      unitResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'assessment_roster',
          )
          .select(
            'id, assessment_id, student_id, cohort_id, pre_assessment_status',
          )
          .in(
            'assessment_id',
            assessmentIds,
          ),

        supabase
          .from(
            'assessment_results',
          )
          .select(
            'id, assessment_event_id, student_id, cohort_id, operational_result_status, operational_mark',
          )
          .in(
            'assessment_event_id',
            assessmentIds,
          )
          .not(
            'operational_result_status',
            'is',
            null,
          ),

        supabase
          .from(
            'academic_periods',
          )
          .select(
            'id, name',
          )
          .eq(
            'id',
            rootEvent.academicPeriodId,
          )
          .maybeSingle(),

        supabase
          .from(
            'units',
          )
          .select(
            'id, name',
          )
          .eq(
            'id',
            rootEvent.unitId,
          )
          .maybeSingle(),
      ]);

    const firstError =
      rosterResult.error ??
      resultResult.error ??
      periodResult.error ??
      unitResult.error;

    if (
      firstError
    ) {
      throw new Error(
        `Unable to load assessment analysis: ${firstError.message}`,
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

    const rawResults =
      (
        resultResult.data ??
        []
      ) as UnknownRow[];

    const resultRows =
      rawResults
        .map(
          (row) =>
            mapAnalysisResult(
              row,
            ),
        )
        .filter(
          (
            row,
          ): row is AssessmentAnalysisResultRow =>
            row !==
            null,
        );

    const rosterStudentIds =
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
            Boolean(
              value,
            ),
        );

    const resultStudentIds =
      resultRows.map(
        (row) =>
          row.studentId,
      );

    const studentIds =
      [
        ...new Set([
          ...rosterStudentIds,
          ...resultStudentIds,
        ]),
      ];

    const cohortIds =
      [
        ...new Set(
          [
            ...events.map(
              (event) =>
                event.cohortId,
            ),
            ...rosterRows.map(
              (row) =>
                asString(
                  row.cohort_id,
                ),
            ),
          ].filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
        ),
      ];

    const [
      studentsResult,
      cohortsResult,
    ] =
      await Promise.all([
        studentIds.length >
        0
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
              data:
                [],
              error:
                null,
            }),

        cohortIds.length >
        0
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
              data:
                [],
              error:
                null,
            }),
      ]);

    const secondError =
      studentsResult.error ??
      cohortsResult.error;

    if (
      secondError
    ) {
      throw new Error(
        `Unable to load assessment analysis labels: ${secondError.message}`,
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

    const resultByStudent =
      new Map(
        rawResults
          .map(
            (
              raw,
              index,
            ) => {
              const mapped =
                resultRows[
                  index
                ];

              return mapped
                ? [
                    mapped.studentId,
                    {
                      mapped,
                      id:
                        asString(
                          raw.id,
                        ),
                    },
                  ] as const
                : null;
            },
          )
          .filter(
            (
              entry,
            ): entry is readonly [
              string,
              {
                mapped: AssessmentAnalysisResultRow;
                id: string | null;
              },
            ] =>
              entry !==
              null,
          ),
      );

    const students:
      AssessmentAnalysisStudentRow[] =
        rosterRows
          .map(
            (roster) => {
              const studentId =
                asString(
                  roster.student_id,
                );

              if (!studentId) {
                return null;
              }

              const student =
                studentById.get(
                  studentId,
                );

              const cohortId =
                asString(
                  roster.cohort_id,
                );

              const result =
                resultByStudent.get(
                  studentId,
                );

              const status =
                result?.mapped.status ??
                (
                  asString(
                    roster.pre_assessment_status,
                  ) ===
                  'absent'
                    ? 'absent'
                    : 'missing_mark'
                );

              const cohortName =
                cohortId
                  ? (
                      cohortById.get(
                        cohortId,
                      )?.name ??
                      'Cohort'
                    )
                  : 'All Cohorts';

              return {
                resultId:
                  result?.id ??
                  null,
                studentId,
                admissionNumber:
                  student
                    ?.admission_number ??
                  'â€”',
                fullName:
                  student
                    ?.full_name ??
                  'Student',
                cohortId,
                cohortName,
                status,
                mark:
                  result
                    ?.mapped.mark ??
                  null,
              } satisfies
                AssessmentAnalysisStudentRow;
            },
          )
          .filter(
            (
              row,
            ): row is AssessmentAnalysisStudentRow =>
              row !==
              null,
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.cohortName.localeCompare(
                second.cohortName,
              ) ||
              first.admissionNumber.localeCompare(
                second.admissionNumber,
              ) ||
              first.fullName.localeCompare(
                second.fullName,
              ),
          );

    const cohortGroups =
      new Map<
        string,
        {
          cohortId:
            string | null;
          cohortName:
            string;
          assessmentIds:
            Set<string>;
          rosterStudentIds:
            Set<string>;
          resultRows:
            AssessmentAnalysisResultRow[];
        }
      >();

    for (
      const roster of
        rosterRows
    ) {
      const cohortId =
        asString(
          roster.cohort_id,
        );

      const key =
        cohortId ??
        '__all__';

      const current =
        cohortGroups.get(
          key,
        ) ??
        {
          cohortId,
          cohortName:
            cohortId
              ? (
                  cohortById.get(
                    cohortId,
                  )?.name ??
                  'Cohort'
                )
              : 'All Cohorts',
          assessmentIds:
            new Set<
              string
            >(),
          rosterStudentIds:
            new Set<
              string
            >(),
          resultRows:
            [],
        };

      const assessmentId =
        asString(
          roster.assessment_id,
        );

      const studentId =
        asString(
          roster.student_id,
        );

      if (
        assessmentId
      ) {
        current.assessmentIds.add(
          assessmentId,
        );
      }

      if (
        studentId
      ) {
        current.rosterStudentIds.add(
          studentId,
        );
      }

      cohortGroups.set(
        key,
        current,
      );
    }

    for (
      const result of
        resultRows
    ) {
      const key =
        result.cohortId ??
        '__all__';

      const current =
        cohortGroups.get(
          key,
        );

      if (
        current
      ) {
        current.resultRows.push(
          result,
        );

        current.assessmentIds.add(
          result.assessmentId,
        );
      }
    }

    const cohorts =
      [...cohortGroups.values()]
        .map(
          (group) => ({
            cohortId:
              group.cohortId,
            cohortName:
              group.cohortName,
            assessmentIds:
              [...group.assessmentIds],
            summary:
              calculateAssessmentAnalysis({
                registeredPopulation:
                  group.rosterStudentIds.size,
                rows:
                  group.resultRows,
              }),
          }),
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

    return {
      rootAssessmentId,
      academicPeriodId:
        rootEvent.academicPeriodId,
      academicPeriodName:
        periodResult.data.name,
      unitId:
        rootEvent.unitId,
      unitName:
        unitResult.data.name,
      assessmentType:
        rootEvent.assessmentType,
      status:
        deriveAssessmentBundleStatus(
          events.map(
            (event) =>
              event.workflowStatus,
          ),
        ),
      assessmentIds,
      summary:
        calculateAssessmentAnalysis({
          registeredPopulation:
            new Set(
              rosterStudentIds,
            ).size,
          rows:
            resultRows,
        }),
      cohorts,
      students,
    };
  });
