import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  AcademicYear,
  AcademicYearRow,
} from './types';

const academicYearSelection = `
  id,
  name,
  starts_on,
  ends_on,
  status,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

function mapAcademicYear(
  row: AcademicYearRow,
): AcademicYear {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getAcademicYears = cache(
  async (): Promise<AcademicYear[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_years')
      .select(academicYearSelection)
      .order('starts_on', {
        ascending: false,
      });

    if (error) {
      throw new Error(
        `Unable to load Academic Years: ${error.message}`,
      );
    }

    return (
      (data ?? []) as AcademicYearRow[]
    ).map(mapAcademicYear);
  },
);

export const getAcademicYearById = cache(
  async (
    id: string,
  ): Promise<AcademicYear | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_years')
      .select(academicYearSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the Academic Year: ${error.message}`,
      );
    }

    return data
      ? mapAcademicYear(data as AcademicYearRow)
      : null;
  },
);

export const getActiveAcademicYear = cache(
  async (): Promise<AcademicYear | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('academic_years')
      .select(academicYearSelection)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the active Academic Year: ${error.message}`,
      );
    }

    return data
      ? mapAcademicYear(data as AcademicYearRow)
      : null;
  },
);