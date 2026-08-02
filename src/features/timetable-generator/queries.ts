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
} from './server-types';

export interface GeneratorSourceData {
  academicPeriod: AcademicPeriod;
  allocations: TeachingAllocation[];
  workingDays: WorkingDay[];
  timeSlots: TimeSlot[];
  trainers: Trainer[];
  cohorts: Cohort[];
  rooms: Room[];
  units: Unit[];
  existingSessions:
    ExistingScheduledSessionRow[];
}

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
      } = await supabase
        .from('scheduled_sessions')
        .select(`
          id,
          academic_period_id,
          teaching_allocation_id,
          cohort_id,
          unit_id,
          trainer_id,
          working_day_id,
          start_time_slot_id,
          end_time_slot_id,
          room_id,
          session_number,
          delivery_mode,
          status,
          source,
          conflict_state,
          is_locked,
          notes,
          created_at,
          updated_at
        `)
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .in('status', [
          'draft',
          'confirmed',
          'locked',
        ])
        .order('working_day_id', {
          ascending: true,
        })
        .order('start_time_slot_id', {
          ascending: true,
        })
        .order('session_number', {
          ascending: true,
        });

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
        cohorts,
        rooms,
        units,
        existingSessions,
      };
    },
  );