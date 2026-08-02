import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  detectTimetableConflicts,
  detectTrainerWorkloadConflicts,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

describe('trainer workload conflicts', () => {
  it('detects daily workload overload', () => {
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

    input.trainers[0]
      .maximumDailyHours = 2;

    const conflicts =
      detectTrainerWorkloadConflicts({
        sessions: input.sessions,
        trainers: input.trainers,
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      conflicts.map(
        (conflict) =>
          conflict.type,
      ),
    ).toContain(
      'trainer_daily_workload',
    );
  });

  it('detects weekly workload overload', () => {
    const tuesday:
    PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      workingDayId: 'day-2',
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      roomId: 'room-2',
    };

    const input =
      createConflictInput([
        baseSession,
        tuesday,
      ]);

    input.trainers[0]
      .maximumWeeklyHours = 3;

    const conflicts =
      detectTrainerWorkloadConflicts({
        sessions: input.sessions,
        trainers: input.trainers,
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      conflicts.map(
        (conflict) =>
          conflict.type,
      ),
    ).toContain(
      'trainer_weekly_workload',
    );
  });

  it('does not double-count overlap for workload limits', () => {
    const overlapping:
    PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      roomId: 'room-2',
      startTimeSlotId: 'slot-2',
      endTimeSlotId: 'slot-3',
    };

    const input =
      createConflictInput([
        baseSession,
        overlapping,
      ]);

    input.trainers[0]
      .maximumDailyHours = 3;

    const conflicts =
      detectTrainerWorkloadConflicts({
        sessions: input.sessions,
        trainers: input.trainers,
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
      });

    expect(
      conflicts.map(
        (conflict) =>
          conflict.type,
      ),
    ).not.toContain(
      'trainer_daily_workload',
    );
  });

  it('adds workload conflicts to the main detector', () => {
    const input =
      createConflictInput();

    input.trainers[0]
      .maximumDailyHours = 1;

    expect(
      detectTimetableConflicts(
        input,
      ).map(
        (conflict) =>
          conflict.type,
      ),
    ).toContain(
      'trainer_daily_workload',
    );
  });

  it('creates a fatigue warning for a long continuous block', () => {
    const input =
      createConflictInput();

    const conflicts =
      detectTrainerWorkloadConflicts({
        sessions: input.sessions,
        trainers: input.trainers,
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
        options: {
          fatigueWarningMinutes:
            90,
        },
      });

    expect(
      conflicts.some(
        (conflict) =>
          conflict.type ===
            'trainer_daily_workload' &&
          conflict.severity ===
            'warning',
      ),
    ).toBe(true);
  });
});