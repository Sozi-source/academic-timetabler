import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  Programme,
  ProgrammeRow,
} from './types';

const programmeSelection = `
  id,
  department_id,
  code,
  name,
  short_name,
  award_level,
  awarding_body,
  duration_value,
  duration_unit,
  total_academic_periods,
  maximum_cohort_size,
  is_active,
  is_timetable_available,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

function mapProgramme(
  row: ProgrammeRow,
): Programme {
  return {
    id: row.id,
    departmentId: row.department_id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    awardLevel: row.award_level,
    awardingBody: row.awarding_body,
    durationValue: Number(
      row.duration_value,
    ),
    durationUnit: row.duration_unit,
    totalAcademicPeriods:
      row.total_academic_periods,
    maximumCohortSize:
      row.maximum_cohort_size,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getProgrammes = cache(
  async (): Promise<Programme[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('programmes')
      .select(programmeSelection)
      .order('is_active', {
        ascending: false,
      })
      .order('name', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load programmes: ${error.message}`,
      );
    }

    return (
      (data ?? []) as ProgrammeRow[]
    ).map(mapProgramme);
  },
);

export const getProgrammeById = cache(
  async (
    id: string,
  ): Promise<Programme | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('programmes')
      .select(programmeSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the programme: ${error.message}`,
      );
    }

    return data
      ? mapProgramme(
          data as ProgrammeRow,
        )
      : null;
  },
);

export const getTimetableAvailableProgrammes =
  cache(
    async (): Promise<Programme[]> => {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('programmes')
        .select(programmeSelection)
        .eq('is_active', true)
        .eq(
          'is_timetable_available',
          true,
        )
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load timetable programmes: ${error.message}`,
        );
      }

      return (
        (data ?? []) as ProgrammeRow[]
      ).map(mapProgramme);
    },
  );
