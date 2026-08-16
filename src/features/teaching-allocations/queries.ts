import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import {
  normalizeParticipantCohortIds,
} from '@/features/timetable-generator/participant-cohorts';

import type {
  AllocationAcademicPeriodSummary,
  AllocationCohortSummary,
  AllocationRoomSummary,
  AllocationTrainerSummary,
  AllocationUnitSummary,
  TeachingAllocation,
  TeachingAllocationRow,
  TrainerWorkloadSummary,
} from './types';

const teachingAllocationSelection = `
  id,
  academic_period_id,
  cohort_id,
  unit_id,
  trainer_id,
  preferred_room_id,
  participant_cohort_ids,
  combined_cohort_size,
  delivery_mode,
  weekly_sessions,
  session_duration_minutes,
  fixed_working_day_id,
  fixed_working_day_ids,
  fixed_time_slot_ids,
  is_full_day_session,
  fixed_end_time_slot_id,
  status,
  is_timetable_enabled,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at,

  academic_periods (
    id,
    code,
    name,
    status,
    starts_on,
    ends_on
  ),

  cohorts (
    id,
    programme_id,
    code,
    name,
    actual_size,
    current_academic_period_number,
    status,
    is_timetable_available
  ),

  units (
    id,
    programme_id,
    code,
    name,
    academic_period_number,
    theory_hours,
    practical_hours,
    weekly_sessions,
    preferred_room_type,
    is_active,
    is_timetable_available
  ),

  trainers (
    id,
    staff_number,
    full_name,
    maximum_weekly_hours,
    maximum_daily_hours,
    is_active,
    is_timetable_available
  ),

  rooms (
    id,
    code,
    name,
    room_type,
    capacity,
    is_active,
    is_timetable_available
  )
`;

function getRelation<T>(
  value: T | T[] | null,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapAcademicPeriod(
  value: TeachingAllocationRow[
    'academic_periods'
  ],
): AllocationAcademicPeriodSummary | null {
  const row = getRelation(value);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

function mapCohort(
  value: TeachingAllocationRow['cohorts'],
): AllocationCohortSummary | null {
  const row = getRelation(value);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    programmeId: row.programme_id,
    code: row.code,
    name: row.name,
    actualSize: row.actual_size,
    currentAcademicPeriodNumber:
      row.current_academic_period_number,
    status: row.status,
    isTimetableAvailable:
      row.is_timetable_available,
  };
}

function mapUnit(
  value: TeachingAllocationRow['units'],
): AllocationUnitSummary | null {
  const row = getRelation(value);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    programmeId: row.programme_id,
    code: row.code,
    name: row.name,
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
  };
}

function mapTrainer(
  value: TeachingAllocationRow['trainers'],
): AllocationTrainerSummary | null {
  const row = getRelation(value);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    staffNumber: row.staff_number,
    fullName: row.full_name,
    maximumWeeklyHours: Number(
      row.maximum_weekly_hours,
    ),
    maximumDailyHours: Number(
      row.maximum_daily_hours,
    ),
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
  };
}

function mapRoom(
  value: TeachingAllocationRow['rooms'],
): AllocationRoomSummary | null {
  const row = getRelation(value);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    roomType: row.room_type,
    capacity: row.capacity,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
  };
}

function mapTeachingAllocation(
  row: TeachingAllocationRow,
): TeachingAllocation {
  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,
    cohortId: row.cohort_id,
    unitId: row.unit_id,
    trainerId: row.trainer_id,
    preferredRoomId:
      row.preferred_room_id,
    participantCohortIds:
      normalizeParticipantCohortIds({
        cohortId: row.cohort_id,
        participantCohortIds:
          row.participant_cohort_ids,
      }),
    combinedCohortSize: row.combined_cohort_size ?? 0,
    deliveryMode: row.delivery_mode,
    weeklySessions:
      row.weekly_sessions,
    sessionDurationMinutes:
      row.session_duration_minutes,
    fixedWorkingDayId:
      row.fixed_working_day_id,
    fixedWorkingDayIds:
      row.fixed_working_day_ids ?? [],
    fixedTimeSlotIds:
      row.fixed_time_slot_ids ?? [],
    isFullDaySession:
      row.is_full_day_session ?? false,
    fixedEndTimeSlotId:
      row.fixed_end_time_slot_id,
    status: row.status,
    isTimetableEnabled:
      row.is_timetable_enabled,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    academicPeriod: mapAcademicPeriod(
      row.academic_periods,
    ),
    cohort: mapCohort(row.cohorts),
    unit: mapUnit(row.units),
    trainer: mapTrainer(row.trainers),
    preferredRoom: mapRoom(row.rooms),
  };
}

export const getTeachingAllocations =
  cache(
    async (): Promise<
      TeachingAllocation[]
    > => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('teaching_allocations')
          .select(
            teachingAllocationSelection,
          )
          .order('academic_period_id', {
            ascending: false,
          })
          .order('status', {
            ascending: true,
          })
          .order('created_at', {
            ascending: false,
          });

      if (error) {
        throw new Error(
          `Unable to load teaching allocations: ${error.message}`,
        );
      }

      return (
        (data ?? []) as TeachingAllocationRow[]
      ).map(mapTeachingAllocation);
    },
  );

export const getTeachingAllocationById =
  cache(
    async (
      id: string,
    ): Promise<TeachingAllocation | null> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('teaching_allocations')
          .select(
            teachingAllocationSelection,
          )
          .eq('id', id)
          .maybeSingle();

      if (error) {
        throw new Error(
          `Unable to load the teaching allocation: ${error.message}`,
        );
      }

      return data
        ? mapTeachingAllocation(
            data as TeachingAllocationRow,
          )
        : null;
    },
  );

export const getTeachingAllocationsByPeriod =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<TeachingAllocation[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('teaching_allocations')
          .select(
            teachingAllocationSelection,
          )
          .eq(
            'academic_period_id',
            academicPeriodId,
          )
          .order('cohort_id', {
            ascending: true,
          })
          .order('created_at', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load Academic Period allocations: ${error.message}`,
        );
      }

      return (
        (data ?? []) as TeachingAllocationRow[]
      ).map(mapTeachingAllocation);
    },
  );

export const getTimetableEnabledAllocations =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<TeachingAllocation[]> => {
      const supabase =
        await createClient();

      const { data, error } =
        await supabase
          .from('teaching_allocations')
          .select(
            teachingAllocationSelection,
          )
          .eq(
            'academic_period_id',
            academicPeriodId,
          )
          .eq(
            'is_timetable_enabled',
            true,
          )
          .in('status', [
            'draft',
            'active',
          ])
          .order('cohort_id', {
            ascending: true,
          });

      if (error) {
        throw new Error(
          `Unable to load timetable-enabled allocations: ${error.message}`,
        );
      }

      return (
        (data ?? []) as TeachingAllocationRow[]
      ).map(mapTeachingAllocation);
    },
  );

export const getTrainerWorkloadSummary =
  cache(
    async (
      trainerId: string,
      academicPeriodId: string,
    ): Promise<TrainerWorkloadSummary> => {
      const supabase =
        await createClient();

      const {
        data: trainer,
        error: trainerError,
      } = await supabase
        .from('trainers')
        .select(
          'id, maximum_weekly_hours',
        )
        .eq('id', trainerId)
        .single();

      if (trainerError) {
        throw new Error(
          `Unable to load trainer workload limit: ${trainerError.message}`,
        );
      }

      const {
        data: allocations,
        error: allocationError,
      } = await supabase
        .from('teaching_allocations')
        .select(
          'weekly_sessions, session_duration_minutes',
        )
        .eq('trainer_id', trainerId)
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .in('status', [
          'draft',
          'active',
        ]);

      if (allocationError) {
        throw new Error(
          `Unable to calculate trainer workload: ${allocationError.message}`,
        );
      }

      const allocatedMinutes = (
        allocations ?? []
      ).reduce(
        (total, allocation) =>
          total +
          allocation.weekly_sessions *
            allocation.session_duration_minutes,
        0,
      );

      const maximumWeeklyHours = Number(
        trainer.maximum_weekly_hours,
      );

      const allocatedWeeklyHours =
        allocatedMinutes / 60;

      const remainingWeeklyHours =
        Math.max(
          maximumWeeklyHours -
            allocatedWeeklyHours,
          0,
        );

      const utilizationPercentage =
        maximumWeeklyHours > 0
          ? Math.round(
              (allocatedWeeklyHours /
                maximumWeeklyHours) *
                100,
            )
          : 0;

      return {
        trainerId,
        maximumWeeklyHours,
        allocatedWeeklyHours,
        remainingWeeklyHours,
        utilizationPercentage,
      };
    },
  );
