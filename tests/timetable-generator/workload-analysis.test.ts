import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  analyzeTrainerWorkloads,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

describe('analyzeTrainerWorkloads', () => {
  it('calculates daily and weekly teaching hours', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      roomId: 'room-2',
      startTimeSlotId: 'slot-3',
      endTimeSlotId: 'slot-3',
    };

    const input =
      createConflictInput([
        baseSession,
        second,
      ]);

    const [analysis] =
      analyzeTrainerWorkloads({
        sessions: input.sessions,
        trainers: [
          input.trainers[0],
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      analysis.weeklyTeachingMinutes,
    ).toBe(180);

    expect(
      analysis.daily[0]
        .teachingHours,
    ).toBe(3);
  });

  it('does not double-count overlapping intervals', () => {
    const overlapping:
    PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      cohortId: 'cohort-2',
      roomId: 'room-2',
      unitId: 'unit-2',
      startTimeSlotId: 'slot-2',
      endTimeSlotId: 'slot-3',
    };

    const input =
      createConflictInput([
        baseSession,
        overlapping,
      ]);

    const [analysis] =
      analyzeTrainerWorkloads({
        sessions: input.sessions,
        trainers: [
          input.trainers[0],
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      analysis.weeklyTeachingMinutes,
    ).toBe(180);
  });

  it('calculates idle gaps', () => {
    const later: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      startTimeSlotId: 'slot-3',
      endTimeSlotId: 'slot-3',
    };

    const input =
      createConflictInput([
        {
          ...baseSession,
          endTimeSlotId: 'slot-1',
        },
        later,
      ]);

    const [analysis] =
      analyzeTrainerWorkloads({
        sessions: input.sessions,
        trainers: [
          input.trainers[0],
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      analysis.daily[0]
        .idleMinutes,
    ).toBe(60);

    expect(
      analysis.daily[0]
        .largestIdleGapMinutes,
    ).toBe(60);

    expect(
      analysis.daily[0]
        .utilizationPercentage,
    ).toBe(66.7);
  });

  it('ignores cancelled sessions', () => {
    const input =
      createConflictInput([
        {
          ...baseSession,
          status: 'cancelled',
        },
      ]);

    const [analysis] =
      analyzeTrainerWorkloads({
        sessions: input.sessions,
        trainers: [
          input.trainers[0],
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      analysis.weeklyTeachingMinutes,
    ).toBe(0);
  });
});