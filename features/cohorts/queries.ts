import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import { getEffectiveCohortLifecycle } from './lifecycle';

import type {
  Cohort,
  CohortProgrammeSummary,
  CohortRow,
} from './types';

const cohortSelection = `
  id,
  programme_id,
  code,
  name,
  intake_date,
  expected_completion_date,
  current_academic_period_number,
  planned_size,
  actual_size,
  status,
  is_timetable_available,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at,
  programmes (
    id,
    code,
    name,
    total_academic_periods,
    maximum_cohort_size,
    is_active,
    is_timetable_available
  )
`;

function getProgrammeRelation(
  value: CohortRow['programmes'],
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapProgramme(
  row: ReturnType<
    typeof getProgrammeRelation
  >,
): CohortProgrammeSummary | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    totalAcademicPeriods:
      row.total_academic_periods,
    maximumCohortSize:
      row.maximum_cohort_size,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
  };
}

function mapCohort(
  row: CohortRow,
): Cohort {
  const lifecycle = getEffectiveCohortLifecycle({
    status: row.status,
    intakeDate: row.intake_date,
    expectedCompletionDate:
      row.expected_completion_date,
    isTimetableAvailable:
      row.is_timetable_available,
  });
  return {
    id: row.id,
    programmeId: row.programme_id,
    code: row.code,
    name: row.name,
    intakeDate: row.intake_date,
    expectedCompletionDate:
      row.expected_completion_date,
    currentAcademicPeriodNumber:
      row.current_academic_period_number,
    plannedSize: row.planned_size,
    actualSize: row.actual_size,
    status: lifecycle.status,
    isTimetableAvailable:
      lifecycle.isTimetableAvailable,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    programme: mapProgramme(
      getProgrammeRelation(
        row.programmes,
      ),
    ),
  };
}

export const getCohorts = cache(
  async (): Promise<Cohort[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cohorts')
      .select(cohortSelection)
      .order('status', {
        ascending: true,
      })
      .order('intake_date', {
        ascending: false,
      })
      .order('name', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load cohorts: ${error.message}`,
      );
    }

    return (
      (data ?? []) as CohortRow[]
    ).map(mapCohort);
  },
);

export const getCohortById = cache(
  async (
    id: string,
  ): Promise<Cohort | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cohorts')
      .select(cohortSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the cohort: ${error.message}`,
      );
    }

    return data
      ? mapCohort(data as CohortRow)
      : null;
  },
);

export const getCohortsByProgramme =
  cache(
    async (
      programmeId: string,
    ): Promise<Cohort[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('cohorts')
          .select(cohortSelection)
          .eq(
            'programme_id',
            programmeId,
          )
          .order('intake_date', {
            ascending: false,
          });

      if (error) {
        throw new Error(
          `Unable to load programme cohorts: ${error.message}`,
        );
      }

      return (
        (data ?? []) as CohortRow[]
      ).map(mapCohort);
    },
  );

export const getTimetableAvailableCohorts =
  cache(
    async (): Promise<Cohort[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('cohorts')
          .select(cohortSelection)
          .eq('status', 'active')
          .eq(
            'is_timetable_available',
            true,
          )
          .order('name', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load timetable cohorts: ${error.message}`,
        );
      }

      return (
        (data ?? []) as CohortRow[]
      ).map(mapCohort).filter(
        (cohort) =>
          cohort.status === 'active' &&
          cohort.isTimetableAvailable,
      );
    },
  );