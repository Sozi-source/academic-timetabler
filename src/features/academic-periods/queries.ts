import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  AcademicPeriod,
  AcademicPeriodRow,
} from './types';

const academicPeriodSelection = `
  id,
  academic_year_id,
  name,
  code,
  sequence_number,
  starts_on,
  ends_on,
  teaching_starts_on,
  teaching_ends_on,
  status,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at,
  academic_years (
    id,
    name,
    starts_on,
    ends_on,
    status
  )
`;

function getAcademicYearRelation(
  row: AcademicPeriodRow,
) {
  if (Array.isArray(row.academic_years)) {
    return row.academic_years[0] ?? null;
  }

  return row.academic_years;
}

function mapAcademicPeriod(
  row: AcademicPeriodRow,
): AcademicPeriod {
  const academicYear =
    getAcademicYearRelation(row);

  if (!academicYear) {
    throw new Error(
      'The Academic Period has no valid Academic Year.',
    );
  }

  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    academicYear: {
      id: academicYear.id,
      name: academicYear.name,
      startsOn: academicYear.starts_on,
      endsOn: academicYear.ends_on,
      status: academicYear.status,
    },
    name: row.name,
    code: row.code,
    sequenceNumber: row.sequence_number,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    teachingStartsOn: row.teaching_starts_on,
    teachingEndsOn: row.teaching_ends_on,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getAcademicPeriods = cache(
  async (): Promise<AcademicPeriod[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_periods')
      .select(academicPeriodSelection)
      .order('starts_on', {
        ascending: false,
      })
      .order('sequence_number', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load Academic Periods: ${error.message}`,
      );
    }

    return (
      (data ?? []) as unknown as
        AcademicPeriodRow[]
    ).map(mapAcademicPeriod);
  },
);

export const getAcademicPeriodById = cache(
  async (
    id: string,
  ): Promise<AcademicPeriod | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_periods')
      .select(academicPeriodSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the Academic Period: ${error.message}`,
      );
    }

    return data
      ? mapAcademicPeriod(
          data as unknown as AcademicPeriodRow,
        )
      : null;
  },
);

export const getActiveAcademicPeriod = cache(
  async (): Promise<AcademicPeriod | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_periods')
      .select(academicPeriodSelection)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the active Academic Period: ${error.message}`,
      );
    }

    return data
      ? mapAcademicPeriod(
          data as unknown as AcademicPeriodRow,
        )
      : null;
  },
);