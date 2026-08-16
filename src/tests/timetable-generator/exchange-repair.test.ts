import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  evaluateTrainerExchangeSuggestion,
  findTrainerExchangeSuggestions,
  generateTimetablePlan,
  type AutomaticPlannerInput,
  type PlanningAllocation,
} from '@/features/timetable-generator';

import {
  baseSession,
} from './fixtures';
import {
  baseAllocation,
  createPlannerInput,
} from './planner-fixtures';

function createExchangeInput(): AutomaticPlannerInput {
  const target: PlanningAllocation = {
    ...baseAllocation,
    fixedWorkingDayId: 'day-1',
    fixedWorkingDayIds: ['day-1'],
    fixedTimeSlotIds: ['slot-1'],
  };
  const partner: PlanningAllocation = {
    ...baseAllocation,
    id: 'allocation-2',
    cohortId: 'cohort-2',
    unitId: 'unit-2',
    trainerId: 'trainer-2',
    fixedWorkingDayId: 'day-2',
    fixedWorkingDayIds: ['day-2'],
    fixedTimeSlotIds: ['slot-1'],
  };
  const input = createPlannerInput({
    allocations: [target, partner],
  });

  input.trainers = input.trainers.map((trainer) => ({
    ...trainer,
    availabilityMode: 'selected_slots_only',
    availableSlots: trainer.id === 'trainer-1'
      ? [
          { workingDayId: 'day-2', timeSlotId: 'slot-1' },
          { workingDayId: 'day-2', timeSlotId: 'slot-2' },
        ]
      : [
          { workingDayId: 'day-1', timeSlotId: 'slot-1' },
          { workingDayId: 'day-1', timeSlotId: 'slot-2' },
        ],
  }));

  return input;
}

describe('same-department trainer exchange repair', () => {
  it('rechecks only the selected exchange against the current timetable', () => {
    const input = createExchangeInput();
    const baseline = generateTimetablePlan(input);

    expect(evaluateTrainerExchangeSuggestion({
      input,
      baseline,
      targetTeachingAllocationId: 'allocation-1',
      targetSessionNumber: 1,
      partnerTeachingAllocationId: 'allocation-2',
    })).toEqual(expect.objectContaining({
      targetTeachingAllocationId: 'allocation-1',
      partnerTeachingAllocationId: 'allocation-2',
      resolvedSessionCount: 2,
    }));
  });

  it('rejects a selected exchange when the request is stale', () => {
    const input = createExchangeInput();
    const baseline = generateTimetablePlan(input);

    expect(evaluateTrainerExchangeSuggestion({
      input,
      baseline,
      targetTeachingAllocationId: 'allocation-1',
      targetSessionNumber: 99,
      partnerTeachingAllocationId: 'allocation-2',
    })).toBeNull();
  });

  it('finds an equal-duration trainer exchange that resolves both fixed sessions', () => {
    const input = createExchangeInput();
    const baseline = generateTimetablePlan(input);

    expect(baseline.unscheduled).toHaveLength(2);

    const suggestions = findTrainerExchangeSuggestions({
      input,
      baseline,
    });

    expect(suggestions).toContainEqual(expect.objectContaining({
      targetTeachingAllocationId: 'allocation-1',
      partnerTeachingAllocationId: 'allocation-2',
      targetTrainerId: 'trainer-1',
      partnerTrainerId: 'trainer-2',
      durationMinutes: 120,
      resolvedSessionCount: 2,
      remainingUnscheduledCount: 0,
    }));
  });

  it('does not suggest a trainer exchange when session durations differ', () => {
    const input = createExchangeInput();
    input.allocations[1] = {
      ...input.allocations[1],
      sessionDurationMinutes: 60,
    };
    const baseline = generateTimetablePlan(input);

    expect(findTrainerExchangeSuggestions({
      input,
      baseline,
    })).toEqual([]);
  });

  it('does not exchange an allocation with a locked placement', () => {
    const input = createExchangeInput();
    input.existingSessions = [{
      ...baseSession,
      id: 'locked-partner-session',
      teachingAllocationId: 'allocation-2',
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      trainerId: 'trainer-2',
      workingDayId: 'day-2',
      isLocked: true,
      status: 'locked',
    }];
    const baseline = generateTimetablePlan(input);

    expect(findTrainerExchangeSuggestions({
      input,
      baseline,
    })).toEqual([]);
  });

  it('does not consider a trainer outside the current department planning input', () => {
    const input = createExchangeInput();
    input.trainers = input.trainers.filter(
      (trainer) => trainer.id !== 'trainer-2',
    );
    const baseline = generateTimetablePlan(input);

    expect(findTrainerExchangeSuggestions({
      input,
      baseline,
    })).toEqual([]);
  });
});
