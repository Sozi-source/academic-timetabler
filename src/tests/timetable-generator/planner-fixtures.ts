import type {
  AutomaticPlannerInput,
  PlanningAllocation,
} from '@/features/timetable-generator';

import {
  createConflictInput,
} from './fixtures';

export const baseAllocation:
PlanningAllocation = {
  id: 'allocation-1',
  academicPeriodId: 'period-1',
  cohortId: 'cohort-1',
  unitId: 'unit-1',
  trainerId: 'trainer-1',
  preferredRoomId: null,
  deliveryMode: 'theory',
  weeklySessions: 1,
  sessionDurationMinutes: 120,
  isTimetableEnabled: true,
};

export function createPlannerInput({
  allocations = [
    baseAllocation,
  ],
}: {
  allocations?: PlanningAllocation[];
} = {}): AutomaticPlannerInput {
  const conflictInput =
    createConflictInput([]);

  return {
    academicPeriodId: 'period-1',
    allocations,
    existingSessions: [],
    workingDays:
      conflictInput.workingDays,
    timeSlots:
      conflictInput.timeSlots,
    trainers:
      conflictInput.trainers,
    cohorts:
      conflictInput.cohorts,
    rooms:
      conflictInput.rooms,
    units:
      conflictInput.units,
  };
}