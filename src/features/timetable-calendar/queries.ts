import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  TimeSlot,
  TimeSlotRow,
  WorkingDay,
  WorkingDayRow,
} from './types';

function mapWorkingDay(
  row: WorkingDayRow,
): WorkingDay {
  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,
    dayOfWeek: row.day_of_week,
    sequenceNumber: row.sequence_number,
    isEnabled: row.is_enabled,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTimeSlot(
  row: TimeSlotRow,
): TimeSlot {
  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,
    name: row.name,
    code: row.code,
    slotType: row.slot_type,
    startsAt: row.starts_at.slice(0, 5),
    endsAt: row.ends_at.slice(0, 5),
    sequenceNumber: row.sequence_number,
    isEnabled: row.is_enabled,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getWorkingDaysByPeriod = cache(
  async (
    academicPeriodId: string,
  ): Promise<WorkingDay[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('working_days')
      .select(`
        id,
        academic_period_id,
        day_of_week,
        sequence_number,
        is_enabled,
        notes,
        created_at,
        updated_at
      `)
      .eq(
        'academic_period_id',
        academicPeriodId,
      )
      .order('sequence_number', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load Working Days: ${error.message}`,
      );
    }

    return (
      (data ?? []) as WorkingDayRow[]
    ).map(mapWorkingDay);
  },
);

export const getTimeSlotsByPeriod = cache(
  async (
    academicPeriodId: string,
  ): Promise<TimeSlot[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('time_slots')
      .select(`
        id,
        academic_period_id,
        name,
        code,
        slot_type,
        starts_at,
        ends_at,
        sequence_number,
        is_enabled,
        notes,
        created_at,
        updated_at
      `)
      .eq(
        'academic_period_id',
        academicPeriodId,
      )
      .order('sequence_number', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load Time Slots: ${error.message}`,
      );
    }

    return (
      (data ?? []) as TimeSlotRow[]
    ).map(mapTimeSlot);
  },
);

export const getWorkingDayById = cache(
  async (
    id: string,
  ): Promise<WorkingDay | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('working_days')
      .select(`
        id,
        academic_period_id,
        day_of_week,
        sequence_number,
        is_enabled,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the Working Day: ${error.message}`,
      );
    }

    return data
      ? mapWorkingDay(
          data as WorkingDayRow,
        )
      : null;
  },
);

export const getTimeSlotById = cache(
  async (
    id: string,
  ): Promise<TimeSlot | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('time_slots')
      .select(`
        id,
        academic_period_id,
        name,
        code,
        slot_type,
        starts_at,
        ends_at,
        sequence_number,
        is_enabled,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the Time Slot: ${error.message}`,
      );
    }

    return data
      ? mapTimeSlot(
          data as TimeSlotRow,
        )
      : null;
  },
);