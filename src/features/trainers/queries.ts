import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  Trainer,
  TrainerRow,
} from './types';

const trainerSelection = `
  id,
  profile_id,
  staff_number,
  full_name,
  email,
  phone_number,
  employment_type,
  specialization,
  qualifications,
  maximum_weekly_hours,
  maximum_daily_hours,
  is_active,
  is_timetable_available,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

function mapTrainer(
  row: TrainerRow,
): Trainer {
  return {
    id: row.id,
    profileId: row.profile_id,
    staffNumber: row.staff_number,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    employmentType: row.employment_type,
    specialization: row.specialization,
    qualifications: row.qualifications,
    maximumWeeklyHours: Number(
      row.maximum_weekly_hours,
    ),
    maximumDailyHours: Number(
      row.maximum_daily_hours,
    ),
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

export const getTrainers = cache(
  async (): Promise<Trainer[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('trainers')
      .select(trainerSelection)
      .order('is_active', {
        ascending: false,
      })
      .order('full_name', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load trainers: ${error.message}`,
      );
    }

    return (
      (data ?? []) as TrainerRow[]
    ).map(mapTrainer);
  },
);

export const getTrainerById = cache(
  async (
    id: string,
  ): Promise<Trainer | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('trainers')
      .select(trainerSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the trainer: ${error.message}`,
      );
    }

    return data
      ? mapTrainer(data as TrainerRow)
      : null;
  },
);

export const getTimetableAvailableTrainers =
  cache(
    async (): Promise<Trainer[]> => {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('trainers')
        .select(trainerSelection)
        .eq('is_active', true)
        .eq(
          'is_timetable_available',
          true,
        )
        .order('full_name', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load timetable trainers: ${error.message}`,
        );
      }

      return (
        (data ?? []) as TrainerRow[]
      ).map(mapTrainer);
    },
  );