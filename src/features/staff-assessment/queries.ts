import 'server-only';

import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  StaffAssessmentSummary,
  StaffUnitAllocation,
  StaffWorkspace,
} from './types';

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

function relation<T>(
  value:
    | T
    | T[]
    | null
    | undefined,
): T | null {
  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return (
    value ??
    null
  );
}

function assessmentKey({
  periodId,
  cohortId,
  unitId,
}: {
  periodId: string;
  cohortId: string;
  unitId: string;
}): string {
  return [
    periodId,
    cohortId,
    unitId,
  ].join(
    ':',
  );
}

export const getStaffWorkspace =
  cache(async (
    profileId: string,
  ): Promise<StaffWorkspace> => {
    const supabase =
      await createClient();

    const {
      data: trainer,
      error: trainerError,
    } = await supabase
      .from(
        'trainers',
      )
      .select(
        'id, full_name, email',
      )
      .eq(
        'profile_id',
        profileId,
      )
      .eq(
        'is_active',
        true,
      )
      .maybeSingle();

    if (
      trainerError
    ) {
      throw new Error(
        `Unable to load staff profile: ${trainerError.message}`,
      );
    }

    if (!trainer) {
      throw new Error(
        'Your authenticated account is not linked to an active trainer record.',
      );
    }

    const {
      data: allocationData,
      error: allocationError,
    } = await supabase
      .from(
        'teaching_allocations',
      )
      .select(
        `
          id,
          academic_period_id,
          cohort_id,
          unit_id,
          status,
          academic_periods (
            id,
            name
          ),
          cohorts (
            id,
            name
          ),
          units (
            id,
            code,
            name
          )
        `,
      )
      .eq(
        'trainer_id',
        trainer.id,
      )
      .in(
        'status',
        [
          'active',
          'completed',
        ],
      );

    if (
      allocationError
    ) {
      throw new Error(
        `Unable to load Teaching Allocations: ${allocationError.message}`,
      );
    }

    const allocations =
      (
        allocationData ??
        []
      ) as UnknownRow[];

    if (
      allocations.length ===
      0
    ) {
      return {
        trainerId:
          trainer.id,
        trainerName:
          trainer.full_name,
        trainerEmail:
          trainer.email,
        allocations:
          [],
      };
    }

    const periodIds =
      [
        ...new Set(
          allocations
            .map(
              (row) =>
                asString(
                  row.academic_period_id,
                ),
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

    const unitIds =
      [
        ...new Set(
          allocations
            .map(
              (row) =>
                asString(
                  row.unit_id,
                ),
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

    const {
      data: eventData,
      error: eventError,
    } = await supabase
      .from(
        'assessment_event_workspace',
      )
      .select(
        'id, academic_period_id, cohort_id, unit_id, assessment_type, workflow_status, population_locked_at',
      )
      .in(
        'academic_period_id',
        periodIds,
      )
      .in(
        'unit_id',
        unitIds,
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
        `Unable to load staff assessments: ${eventError.message}`,
      );
    }

    const events =
      (
        eventData ??
        []
      ) as UnknownRow[];

    const eventIds =
      events
        .map(
          (row) =>
            asString(
              row.id,
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

    const [
      summaryResult,
      rulesResult,
      releaseResult,
    ] =
      await Promise.all([
        eventIds.length >
        0
          ? supabase
              .from(
                'assessment_population_summary',
              )
              .select(
                'assessment_id, registered_population, marked_absent, expected_to_sit',
              )
              .in(
                'assessment_id',
                eventIds,
              )
          : Promise.resolve({
              data:
                [],
              error:
                null,
            }),

        supabase
          .from(
            'assessment_rules',
          )
          .select(
            'academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark',
          )
          .in(
            'academic_period_id',
            periodIds,
          )
          .in(
            'unit_id',
            unitIds,
          ),

        eventIds.length >
        0
          ? supabase
              .from(
                'assessment_events',
              )
              .select(
                'id, published_at',
              )
              .in(
                'id',
                eventIds,
              )
          : Promise.resolve({
              data:
                [],
              error:
                null,
            }),
      ]);

    const supportingError =
      summaryResult.error ??
      rulesResult.error ??
      releaseResult.error;

    if (
      supportingError
    ) {
      throw new Error(
        `Unable to load staff assessment summary: ${supportingError.message}`,
      );
    }

    const summaryByAssessment =
      new Map(
        (
          summaryResult.data ??
          []
        ).map(
          (row) => [
            row.assessment_id,
            row,
          ],
        ),
      );

    const publishedByAssessment =
      new Map(
        (
          releaseResult.data ??
          []
        ).map(
          (row) => [
            row.id,
            Boolean(
              row.published_at,
            ),
          ],
        ),
      );

    const ruleByKey =
      new Map(
        (
          rulesResult.data ??
          []
        ).map(
          (row) => [
            [
              row.academic_period_id,
              row.unit_id,
              row.assessment_type,
            ].join(
              ':',
            ),
            row,
          ],
        ),
      );

    const assessmentsByAllocation =
      new Map<
        string,
        StaffAssessmentSummary[]
      >();

    for (
      const event of
        events
    ) {
      const id =
        asString(
          event.id,
        );

      const periodId =
        asString(
          event.academic_period_id,
        );

      const cohortId =
        asString(
          event.cohort_id,
        );

      const unitId =
        asString(
          event.unit_id,
        );

      const type =
        asString(
          event.assessment_type,
        );

      if (
        !id ||
        !periodId ||
        !cohortId ||
        !unitId ||
        (
          type !==
            'cat' &&
          type !==
            'exam'
        )
      ) {
        continue;
      }

      const population =
        summaryByAssessment.get(
          id,
        );

      const rule =
        ruleByKey.get(
          [
            periodId,
            unitId,
            type,
          ].join(
            ':',
          ),
        );

      const summary:
        StaffAssessmentSummary =
          {
            assessmentId:
              id,
            type,
            workflowStatus:
              asString(
                event.workflow_status,
              ) ??
              'draft',
            registered:
              Number(
                population
                  ?.registered_population ??
                0,
              ),
            absent:
              Number(
                population
                  ?.marked_absent ??
                0,
              ),
            expected:
              Number(
                population
                  ?.expected_to_sit ??
                0,
              ),
            maximumMark:
              asNumber(
                rule
                  ?.maximum_mark,
              ),
            passMark:
              asNumber(
                rule
                  ?.pass_mark,
              ),
            rosterLocked:
              Boolean(
                event.population_locked_at,
              ),
            published:
              publishedByAssessment.get(
                id,
              ) ===
              true,
          };

      const key =
        assessmentKey({
          periodId,
          cohortId,
          unitId,
        });

      const current =
        assessmentsByAllocation.get(
          key,
        ) ??
        [];

      current.push(
        summary,
      );

      assessmentsByAllocation.set(
        key,
        current,
      );
    }

    const mapped:
      StaffUnitAllocation[] =
        allocations
          .map(
            (row) => {
              const allocationId =
                asString(
                  row.id,
                );

              const periodId =
                asString(
                  row.academic_period_id,
                );

              const cohortId =
                asString(
                  row.cohort_id,
                );

              const unitId =
                asString(
                  row.unit_id,
                );

              const period =
                relation(
                  row.academic_periods as
                    | {
                        id: string;
                        name: string;
                      }
                    | Array<{
                        id: string;
                        name: string;
                      }>
                    | null,
                );

              const cohort =
                relation(
                  row.cohorts as
                    | {
                        id: string;
                        name: string;
                      }
                    | Array<{
                        id: string;
                        name: string;
                      }>
                    | null,
                );

              const unit =
                relation(
                  row.units as
                    | {
                        id: string;
                        code: string;
                        name: string;
                      }
                    | Array<{
                        id: string;
                        code: string;
                        name: string;
                      }>
                    | null,
                );

              if (
                !allocationId ||
                !periodId ||
                !cohortId ||
                !unitId ||
                !period ||
                !cohort ||
                !unit
              ) {
                return null;
              }

              const assessments =
                assessmentsByAllocation.get(
                  assessmentKey({
                    periodId,
                    cohortId,
                    unitId,
                  }),
                ) ??
                [];

              return {
                allocationId,
                academicPeriodId:
                  periodId,
                academicPeriodName:
                  period.name,
                cohortId,
                cohortName:
                  cohort.name,
                unitId,
                unitCode:
                  unit.code,
                unitName:
                  unit.name,
                allocationStatus:
                  asString(
                    row.status,
                  ) ??
                  'active',
                cat:
                  assessments.find(
                    (assessment) =>
                      assessment.type ===
                      'cat',
                  ) ??
                  null,
                exam:
                  assessments.find(
                    (assessment) =>
                      assessment.type ===
                      'exam',
                  ) ??
                  null,
              } satisfies
                StaffUnitAllocation;
            },
          )
          .filter(
            (
              row,
            ): row is StaffUnitAllocation =>
              row !==
              null,
          )
          .sort(
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
              first.cohortName.localeCompare(
                second.cohortName,
              ),
          );

    return {
      trainerId:
        trainer.id,
      trainerName:
        trainer.full_name,
      trainerEmail:
        trainer.email,
      allocations:
        mapped,
    };
  });

export async function requireStaffAllocation({
  profileId,
  allocationId,
}: {
  profileId: string;
  allocationId: string;
}) {
  const workspace =
    await getStaffWorkspace(
      profileId,
    );

  const allocation =
    workspace.allocations.find(
      (item) =>
        item.allocationId ===
        allocationId,
    );

  if (!allocation) {
    return null;
  }

  return {
    workspace,
    allocation,
  };
}

export async function requireStaffAssessment({
  profileId,
  allocationId,
  assessmentId,
}: {
  profileId: string;
  allocationId: string;
  assessmentId: string;
}) {
  const context =
    await requireStaffAllocation({
      profileId,
      allocationId,
    });

  if (!context) {
    return null;
  }

  const assessment =
    [
      context.allocation.cat,
      context.allocation.exam,
    ].find(
      (item) =>
        item
          ?.assessmentId ===
        assessmentId,
    );

  if (!assessment) {
    return null;
  }

  return {
    ...context,
    assessment,
  };
}
