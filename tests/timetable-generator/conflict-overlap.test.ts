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

  it('detects a full-day overlap through a shared participant cohort', () => {
    const clinicalRotation: PlanningSession = {
      ...baseSession,
      id: 'clinical-rotation',
      teachingAllocationId:
        'clinical-allocation',
      cohortId: 'cohort-1',
      participantCohortIds: [
        'cohort-1',
        'shared-cohort',
      ],
      endTimeSlotId: 'slot-full-day-end',
      trainerId: 'trainer-1',
      roomId: 'room-1',
    };
    const anatomy: PlanningSession = {
      ...baseSession,
      id: 'anatomy',
      teachingAllocationId:
        'anatomy-allocation',
      cohortId: 'cohort-2',
      participantCohortIds: [
        'cohort-2',
        'shared-cohort',
      ],
      startTimeSlotId: 'slot-3',
      endTimeSlotId: 'slot-3',
      trainerId: 'trainer-2',
      roomId: 'room-2',
    };
    const input = createConflictInput([
      clinicalRotation,
      anatomy,
    ]);

    input.timeSlots.push({
      id: 'slot-full-day-end',
      academicPeriodId: 'period-1',
      code: 'FULL-DAY-END',
      name: 'Afternoon',
      slotType: 'teaching',
      startsAt: '14:00:00',
      endsAt: '16:00:00',
      sequenceNumber: 4,
      isEnabled: true,
    });

    const conflicts =
      detectTimetableConflicts(input);

    expect(conflicts.some(
      (conflict) =>
        conflict.type === 'cohort_overlap' &&
        conflict.severity === 'blocked',
    )).toBe(true);
  });

  it('always includes the primary cohort when stored participant data is stale', () => {
    const first: PlanningSession = {
      ...baseSession,
      participantCohortIds: [
        'different-shared-cohort',
      ],
    };
    const second: PlanningSession = {
      ...baseSession,
      id: 'second-session',
      teachingAllocationId:
        'second-allocation',
      participantCohortIds: [],
      trainerId: 'trainer-2',
      roomId: 'room-2',
      unitId: 'unit-2',
    };

    expect(getTypes([
      first,
      second,
    ])).toContain('cohort_overlap');
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
