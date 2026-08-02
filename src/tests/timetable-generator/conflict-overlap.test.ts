import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  detectTimetableConflicts,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

function getTypes(
  sessions: PlanningSession[],
) {
  return detectTimetableConflicts(
    createConflictInput(sessions),
  ).map((conflict) => conflict.type);
}

describe('resource overlap detection', () => {
  it('detects trainer overlap', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      cohortId: 'cohort-2',
      roomId: 'room-2',
      unitId: 'unit-2',
    };

    expect(
      getTypes([
        baseSession,
        second,
      ]),
    ).toContain('trainer_overlap');
  });

  it('detects cohort overlap', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      trainerId: 'trainer-2',
      roomId: 'room-2',
      unitId: 'unit-2',
    };

    expect(
      getTypes([
        baseSession,
        second,
      ]),
    ).toContain('cohort_overlap');
  });

  it('detects room overlap', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      trainerId: 'trainer-2',
      cohortId: 'cohort-2',
      unitId: 'unit-2',
    };

    expect(
      getTypes([
        baseSession,
        second,
      ]),
    ).toContain('room_overlap');
  });

  it('does not flag adjacent sessions', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      cohortId: 'cohort-2',
      roomId: 'room-2',
      unitId: 'unit-2',
      startTimeSlotId: 'slot-3',
      endTimeSlotId: 'slot-3',
    };

    const types = getTypes([
      baseSession,
      second,
    ]);

    expect(types).not.toContain(
      'trainer_overlap',
    );
  });

  it('does not compare sessions on different days', () => {
    const second: PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      sessionNumber: 1,
      workingDayId: 'day-2',
    };

    const types = getTypes([
      baseSession,
      second,
    ]);

    expect(types).not.toContain(
      'trainer_overlap',
    );
    expect(types).not.toContain(
      'cohort_overlap',
    );
    expect(types).not.toContain(
      'room_overlap',
    );
  });

  it('ignores cancelled sessions', () => {
    const cancelled:
    PlanningSession = {
      ...baseSession,
      id: 'session-2',
      teachingAllocationId:
        'allocation-2',
      status: 'cancelled',
    };

    expect(
      getTypes([
        baseSession,
        cancelled,
      ]),
    ).not.toContain(
      'trainer_overlap',
    );
  });
});