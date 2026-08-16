import 'server-only';

import {
  cache,
} from 'react';

import {
  getAcademicPeriodById,
} from '@/features/academic-periods/queries';
import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import {
  getTimetableAvailableCohorts,
} from '@/features/cohorts/queries';
import type {
  Cohort,
} from '@/features/cohorts/types';
import {
  getTimetableAvailableRooms,
} from '@/features/rooms/queries';
import type {
  Room,
} from '@/features/rooms/types';
import {
  getTimetableEnabledAllocations,
} from '@/features/teaching-allocations/queries';
import type {
  TeachingAllocation,
} from '@/features/teaching-allocations/types';
import {
  getTimeSlotsByPeriod,
  getWorkingDaysByPeriod,
} from '@/features/timetable-calendar/queries';
import type {
  TimeSlot,
  WorkingDay,
} from '@/features/timetable-calendar/types';
import {
  getTimetableAvailableTrainers,
} from '@/features/trainers/queries';
import type {
  Trainer,
} from '@/features/trainers/types';
import {
  getTimetableAvailableUnits,
} from '@/features/units/queries';
import type {
  Unit,
} from '@/features/units/types';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  ExistingScheduledSessionRow,
  TimetableGenerationRunSummary,
} from './server-types';

export interface GeneratorSourceData {
  academicPeriod: AcademicPeriod;
  allocations: TeachingAllocation[];
  workingDays: WorkingDay[];
  timeSlots: TimeSlot[];
  trainers: Trainer[];
  trainerAvailability: GeneratorTrainerAvailability[];
  cohorts: Cohort[];
  rooms: Room[];
  units: Unit[];
  existingSessions:
    ExistingScheduledSessionRow[];
}

export interface GeneratorTrainerAvailability {
  trainerId: string;
  workingDayId: string;
  timeSlotId: string;
}

export const getGeneratorTrainerAvailability = cache(async (
  academicPeriodId: string,
): Promise<GeneratorTrainerAvailability[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trainer_availability')
    .select('trainer_id, working_day_id, time_slot_id')
    .eq('academic_period_id', academicPeriodId);

  if (error) {
    throw new Error(`Unable to load trainer availability: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    trainerId: row.trainer_id,
    workingDayId: row.working_day_id,
    timeSlotId: row.time_slot_id,
  }));
});

export const getExistingScheduledSessions =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      ExistingScheduledSessionRow[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase.rpc(
        'get_institutional_resource_bookings',
        {
          target_academic_period_id:
            academicPeriodId,
        },
      );

      if (error) {
        throw new Error(
          `Unable to load existing scheduled sessions: ${error.message}`,
        );
      }

      return (
        data ?? []
      ) as ExistingScheduledSessionRow[];
    },
  );

export const getGeneratorSourceData =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      GeneratorSourceData | null
    > => {
      const academicPeriod =
        await getAcademicPeriodById(
          academicPeriodId,
        );

      if (!academicPeriod) {
        return null;
      }

      const [
        allocations,
        workingDays,
        timeSlots,
        trainers,
        trainerAvailability,
        cohorts,
        rooms,
        units,
        existingSessions,
      ] = await Promise.all([
        getTimetableEnabledAllocations(
          academicPeriodId,
        ),
        getWorkingDaysByPeriod(
          academicPeriodId,
        ),
        getTimeSlotsByPeriod(
          academicPeriodId,
        ),
        getTimetableAvailableTrainers(),
        getGeneratorTrainerAvailability(academicPeriodId),
        getTimetableAvailableCohorts(),
        getTimetableAvailableRooms(),
        getTimetableAvailableUnits(),
        getExistingScheduledSessions(
          academicPeriodId,
        ),
      ]);

      return {
        academicPeriod,
        allocations,
        workingDays,
        timeSlots,
        trainers,
        trainerAvailability,
        cohorts,
        rooms,
        units,
        existingSessions,
      };
    },
  );

export const getLatestTimetableGenerationRun = cache(
  async (
    academicPeriodId: string,
  ): Promise<TimetableGenerationRunSummary | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('timetable_generation_runs')
      .select(`
        id,
        academic_period_id,
        status,
        requested_session_count,
        scheduled_session_count,
        unscheduled_session_count,
        conflict_count,
        locked_session_count,
        created_at
      `)
      .eq('academic_period_id', academicPeriodId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') return null;
      throw new Error(`Unable to load the latest generation run: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      academicPeriodId: data.academic_period_id,
      status: data.status,
      requestedSessionCount: data.requested_session_count,
      scheduledSessionCount: data.scheduled_session_count,
      unscheduledSessionCount: data.unscheduled_session_count,
      conflictCount: data.conflict_count,
      lockedSessionCount: data.locked_session_count,
      createdAt: data.created_at,
    } as TimetableGenerationRunSummary;
  },
);
