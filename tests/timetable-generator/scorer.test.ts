import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  scorePlacement,
  scorePlacements,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

function scoreCandidate({
  candidate = baseSession,
  existingSessions = [],
}: {
  candidate?: PlanningSession;
  existingSessions?: PlanningSession[];
} = {}) {
  const input =
    createConflictInput();

  return scorePlacement({
    candidate,
    existingSessions,
    workingDays:
      input.workingDays,
    timeSlots:
      input.timeSlots,
    trainers:
      input.trainers,
    cohorts:
      input.cohorts,
    rooms:
      input.rooms,
    units:
      input.units,
  });
}

describe('scorePlacement', () => {
  it('accepts a conflict-free placement', () => {
    const result =
      scoreCandidate();

    expect(result.isValid).toBe(
      true,
    );

    expect(result.score).toBeGreaterThan(
      0,
    );
  });

  it('rejects a trainer-overlapping placement', () => {
    const existing: PlanningSession = {
      ...baseSession,
      id: 'existing-session',
      teachingAllocationId:
        'allocation-2',
      cohortId: 'cohort-2',
      roomId: 'room-2',
      unitId: 'unit-2',
    };

    const result =
      scoreCandidate({
        existingSessions: [
          existing,
        ],
      });

    expect(result.isValid).toBe(
      false,
    );

    expect(
      result.conflicts.map(
        (conflict) =>
          conflict.type,
      ),
    ).toContain(
      'trainer_overlap',
    );

    expect(result.score).toBe(0);
  });

  it('rewards the preferred room type', () => {
    const result =
      scoreCandidate();

    expect(
      result.adjustments.find(
        (adjustment) =>
          adjustment.factor ===
          'preferred_room',
      )?.points,
    ).toBe(10);
  });

  it('penalizes an oversized room', () => {
    const input =
      createConflictInput();

    input.rooms[0].capacity = 200;

    const result =
      scorePlacement({
        candidate: baseSession,
        existingSessions: [],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
        trainers:
          input.trainers,
        cohorts:
          input.cohorts,
        rooms:
          input.rooms,
        units:
          input.units,
      });

    expect(
      result.adjustments.find(
        (adjustment) =>
          adjustment.factor ===
          'room_capacity',
      )?.points,
    ).toBeLessThan(0);
  });

  it('rewards an adjacent trainer session', () => {
    const existing: PlanningSession = {
      ...baseSession,
      id: 'existing-session',
      teachingAllocationId:
        'allocation-2',
      cohortId: 'cohort-2',
      roomId: 'room-2',
      unitId: 'unit-2',
      startTimeSlotId:
        'slot-3',
      endTimeSlotId:
        'slot-3',
    };

    const result =
      scoreCandidate({
        existingSessions: [
          existing,
        ],
      });

    expect(
      result.adjustments.find(
        (adjustment) =>
          adjustment.factor ===
          'trainer_compactness',
      )?.points,
    ).toBeGreaterThan(0);
  });

  it('rewards morning placements', () => {
    const result =
      scoreCandidate();

    expect(
      result.adjustments.find(
        (adjustment) =>
          adjustment.factor ===
          'morning_preference',
      )?.points,
    ).toBe(3);
  });

  it('keeps a placement valid when it creates extra weekly hours', () => {
    const input = createConflictInput();
    input.trainers[0].normalWeeklyHours = 1;

    const result = scorePlacement({
      candidate: baseSession,
      existingSessions: [],
      workingDays: input.workingDays,
      timeSlots: input.timeSlots,
      trainers: input.trainers,
      cohorts: input.cohorts,
      rooms: input.rooms,
      units: input.units,
    });

    expect(result.isValid).toBe(true);
    expect(
      result.conflicts.find(
        (conflict) => conflict.type === 'trainer_weekly_workload',
      )?.severity,
    ).toBe('warning');
  });
});

describe('scorePlacements', () => {
  it('sorts valid higher-scoring placements first', () => {
    const input =
      createConflictInput();

    const invalidCandidate:
    PlanningSession = {
      ...baseSession,
      id: 'candidate-invalid',
    };

    const validCandidate:
    PlanningSession = {
      ...baseSession,
      id: 'candidate-valid',
      trainerId: 'trainer-2',
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      roomId: 'room-2',
      startTimeSlotId: 'slot-3',
      endTimeSlotId: 'slot-3',
    };

    const results =
      scorePlacements({
        candidates: [
          invalidCandidate,
          validCandidate,
        ],
        existingSessions: [
          {
            ...baseSession,
            id: 'existing-session',
            teachingAllocationId:
              'allocation-9',
          },
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
        trainers:
          input.trainers,
        cohorts:
          input.cohorts,
        rooms:
          input.rooms,
        units:
          input.units,
      });

    expect(
      results[0].session.id,
    ).toBe('candidate-valid');

    expect(results[0].isValid).toBe(
      true,
    );

    expect(
      results.at(-1)?.isValid,
    ).toBe(false);
  });
});
