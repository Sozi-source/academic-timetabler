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
          'draft',
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
          'unit_markbook',
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

    const assessmentsByCohort =
      new Map<
        string,
        StaffAssessmentSummary[]
      >();

    const assessmentsByUnit =
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

      const rawType =
        asString(
          event.assessment_type,
        );

      const type =
        rawType === 'unit_markbook'
          ? 'exam'
          : rawType;

      if (
        !id ||
        !periodId ||
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
        ) ??
        ruleByKey.get(
          [
            periodId,
            unitId,
            'exam',
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
              ) ?? 100,
            passMark:
              asNumber(
                rule
                  ?.pass_mark,
              ) ?? 40,
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

      if (cohortId) {
        const key =
          assessmentKey({
            periodId,
            cohortId,
            unitId,
          });

        const current =
          assessmentsByCohort.get(
            key,
          ) ??
          [];

        current.push(
          summary,
        );

        assessmentsByCohort.set(
          key,
          current,
        );
      } else {
        const key = `${periodId}:${unitId}`;

        const current =
          assessmentsByUnit.get(
            key,
          ) ??
          [];

        current.push(
          summary,
        );

        assessmentsByUnit.set(
          key,
          current,
        );
      }
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

              const cohortKey =
                assessmentKey({
                  periodId,
                  cohortId,
                  unitId,
                });
              const unitKey = `${periodId}:${unitId}`;

              const assessments =
                assessmentsByCohort.get(
                  cohortKey,
                ) ??
                assessmentsByUnit.get(
                  unitKey,
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
  let workspace: StaffWorkspace | null = null;
  try {
    workspace = await getStaffWorkspace(profileId);
  } catch {
    workspace = {
      trainerId: profileId,
      trainerName: 'Staff Member',
      trainerEmail: null,
      allocations: [],
    };
  }

  const allocation =
    workspace.allocations.find(
      (item) =>
        item.allocationId ===
        allocationId,
    );

  if (allocation) {
    return {
      workspace,
      allocation,
    };
  }

  // Fallback: Fetch allocation directly via admin client for HOD/Admin oversight
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: rawAlloc } = await admin
    .from('teaching_allocations')
    .select(`
      id,
      academic_period_id,
      cohort_id,
      unit_id,
      status,
      unit:units(id, code, name),
      cohort:cohorts(id, name),
      period:academic_periods(id, name)
    `)
    .eq('id', allocationId)
    .maybeSingle();

  if (!rawAlloc) {
    return null;
  }

  const unit = Array.isArray(rawAlloc.unit) ? rawAlloc.unit[0] : rawAlloc.unit;
  const cohort = Array.isArray(rawAlloc.cohort) ? rawAlloc.cohort[0] : rawAlloc.cohort;
  const period = Array.isArray(rawAlloc.period) ? rawAlloc.period[0] : rawAlloc.period;

  const { data: rawEvent } = await admin
    .from('assessment_events')
    .select('id, workflow_status, population_locked_at, assessment_type, published_at')
    .eq('academic_period_id', rawAlloc.academic_period_id)
    .eq('unit_id', rawAlloc.unit_id)
    .in('assessment_type', ['exam', 'unit_markbook'])
    .maybeSingle();

  let examSummary: StaffAssessmentSummary | null = null;

  if (rawEvent?.id) {
    const { data: pop } = await admin
      .from('assessment_population_summary')
      .select('registered_population, marked_absent, expected_to_sit')
      .eq('assessment_id', rawEvent.id)
      .maybeSingle();

    examSummary = {
      assessmentId: rawEvent.id,
      type: 'exam',
      workflowStatus: asString(rawEvent.workflow_status) ?? 'draft',
      registered: Number(pop?.registered_population ?? 0),
      absent: Number(pop?.marked_absent ?? 0),
      expected: Number(pop?.expected_to_sit ?? 0),
      maximumMark: 100,
      passMark: 40,
      rosterLocked: Boolean(rawEvent.population_locked_at),
      published: Boolean(rawEvent.published_at),
    };
  } else {
    // Dynamic student registration count lookup
    const { count: studentCount } = await admin
      .from('student_unit_registrations')
      .select('student_id', { count: 'exact', head: true })
      .eq('academic_period_id', rawAlloc.academic_period_id)
      .eq('unit_id', rawAlloc.unit_id)
      .eq('registration_status', 'registered');

    let totalCount = studentCount ?? 0;
    if (totalCount === 0 && rawAlloc.cohort_id) {
      const { count: cohortCount } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('current_cohort_id', rawAlloc.cohort_id)
        .in('lifecycle_status', ['admitted', 'active']);
      totalCount = cohortCount ?? 0;
    }

    examSummary = {
      assessmentId: `alloc-${rawAlloc.id}`,
      type: 'exam',
      workflowStatus: 'draft',
      registered: totalCount,
      absent: 0,
      expected: totalCount,
      maximumMark: 100,
      passMark: 40,
      rosterLocked: false,
      published: false,
    };
  }

  const fallbackAllocation: StaffUnitAllocation = {
    allocationId: rawAlloc.id,
    academicPeriodId: rawAlloc.academic_period_id,
    academicPeriodName: period?.name ?? 'Current Semester',
    cohortId: rawAlloc.cohort_id,
    cohortName: cohort?.name ?? 'Cohort',
    unitId: rawAlloc.unit_id,
    unitCode: unit?.code ?? 'UNIT',
    unitName: unit?.name ?? 'Unit Name',
    allocationStatus: rawAlloc.status ?? 'active',
    cat: null,
    exam: examSummary,
  };

  return {
    workspace,
    allocation: fallbackAllocation,
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

  let assessment =
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
    assessment = context.allocation.exam ?? {
      assessmentId: `alloc-${allocationId}`,
      type: 'exam',
      workflowStatus: 'draft',
      registered: 0,
      absent: 0,
      expected: 0,
      maximumMark: 100,
      passMark: 40,
      rosterLocked: false,
      published: false,
    };
  }

  return {
    ...context,
    assessment,
  };
}
