import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  Unit,
  UnitProgrammeSummary,
  UnitRow,
} from './types';

const unitSelection = `
  id,
  programme_id,
  code,
  name,
  short_name,
  category,
  academic_period_number,
  theory_hours,
  practical_hours,
  weekly_sessions,
  preferred_room_type,
  is_active,
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
    is_active,
    is_timetable_available
  )
`;

function getProgrammeRelation(
  value: UnitRow['programmes'],
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
): UnitProgrammeSummary | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    totalAcademicPeriods:
      row.total_academic_periods,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
  };
}

function mapUnit(
  row: UnitRow,
): Unit {
  return {
    id: row.id,
    programmeId: row.programme_id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    category: row.category,
    academicPeriodNumber:
      row.academic_period_number,
    theoryHours: Number(
      row.theory_hours,
    ),
    practicalHours: Number(
      row.practical_hours,
    ),
    weeklySessions:
      row.weekly_sessions,
    preferredRoomType:
      row.preferred_room_type,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
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

export const getUnits = cache(
  async (): Promise<Unit[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('units')
      .select(unitSelection)
      .order('is_active', {
        ascending: false,
      })
      .order('programme_id', {
        ascending: true,
      })
      .order('academic_period_number', {
        ascending: true,
      })
      .order('code', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load units: ${error.message}`,
      );
    }

    return (
      (data ?? []) as UnitRow[]
    ).map(mapUnit);
  },
);

export const getUnitById = cache(
  async (
    id: string,
  ): Promise<Unit | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('units')
      .select(unitSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the unit: ${error.message}`,
      );
    }

    return data
      ? mapUnit(data as UnitRow)
      : null;
  },
);

export const getUnitsByProgramme =
  cache(
    async (
      programmeId: string,
    ): Promise<Unit[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('units')
          .select(unitSelection)
          .eq(
            'programme_id',
            programmeId,
          )
          .order(
            'academic_period_number',
            {
              ascending: true,
            },
          )
          .order('code', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load programme units: ${error.message}`,
        );
      }

      return (
        (data ?? []) as UnitRow[]
      ).map(mapUnit);
    },
  );

export const getUnitsByProgrammePeriod =
  cache(
    async (
      programmeId: string,
      academicPeriodNumber: number,
    ): Promise<Unit[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('units')
          .select(unitSelection)
          .eq(
            'programme_id',
            programmeId,
          )
          .eq(
            'academic_period_number',
            academicPeriodNumber,
          )
          .eq('is_active', true)
          .eq(
            'is_timetable_available',
            true,
          )
          .order('code', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load programme-period units: ${error.message}`,
        );
      }

      return (
        (data ?? []) as UnitRow[]
      ).map(mapUnit);
    },
  );

export const getTimetableAvailableUnits =
  cache(
    async (): Promise<Unit[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('units')
          .select(unitSelection)
          .eq('is_active', true)
          .eq(
            'is_timetable_available',
            true,
          )
          .order('programme_id', {
            ascending: true,
          })
          .order(
            'academic_period_number',
            {
              ascending: true,
            },
          )
          .order('code', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load timetable units: ${error.message}`,
        );
      }

      return (
        (data ?? []) as UnitRow[]
      ).map(mapUnit);
    },
  );