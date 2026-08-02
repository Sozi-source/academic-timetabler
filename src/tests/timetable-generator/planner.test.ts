import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateTimetablePlan,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseAllocation,
  createPlannerInput,
} from './planner-fixtures';

describe('generateTimetablePlan', () => {
  it('places a session using an exact contiguous duration', () => {
    const result =
      generateTimetablePlan(
        createPlannerInput(),
      );

    expect(result.sessions).toHaveLength(
      1,
    );

    expect(
      result.sessions[0]
        .startTimeSlotId,
    ).toBe('slot-1');

    expect(
      result.sessions[0]
        .endTimeSlotId,
    ).toBe('slot-2');

    expect(result.unscheduled).toHaveLength(
      0,
    );

    expect(
      result.statistics
        .scheduledSessionCount,
    ).toBe(1);
  });

  it('places weekly sessions on different days by default', () => {
    const result =
      generateTimetablePlan(
        createPlannerInput({
          allocations: [
            {
              ...baseAllocation,
              weeklySessions: 2,
            },
          ],
        }),
      );

    expect(result.sessions).toHaveLength(
      2,
    );

    expect(
      new Set(
        result.sessions.map(
          (session) =>
            session.workingDayId,
        ),
      ).size,
    ).toBe(2);
  });

  it('does not schedule a disabled allocation', () => {
    const result =
      generateTimetablePlan(
        createPlannerInput({
          allocations: [
            {
              ...baseAllocation,
              isTimetableEnabled:
                false,
            },
          ],
        }),
      );

    expect(result.sessions).toHaveLength(
      0,
    );

    expect(
      result.statistics
        .requestedSessionCount,
    ).toBe(0);
  });

  it('reports a missing matching duration', () => {
    const result =
      generateTimetablePlan(
        createPlannerInput({
          allocations: [
            {
              ...baseAllocation,
              sessionDurationMinutes:
                75,
            },
          ],
        }),
      );

    expect(result.sessions).toHaveLength(
      0,
    );

    expect(
      result.unscheduled[0].reason,
    ).toBe('no_time_range');
  });

  it('reports sessions that cannot fit any room', () => {
    const input =
      createPlannerInput();

    input.cohorts[0].actualSize =
      100;

    const result =
      generateTimetablePlan(input);

    expect(result.sessions).toHaveLength(
      0,
    );

    expect(
      result.unscheduled[0].reason,
    ).toBe(
      'no_valid_placement',
    );

    expect(
      result.unscheduled[0]
        .conflictTypes,
    ).toContain(
      'insufficient_room_capacity',
    );
  });

  it('respects an existing trainer booking', () => {
    const input =
      createPlannerInput();

    const existing:
    PlanningSession = {
      id: 'existing-1',
      academicPeriodId:
        'period-1',
      teachingAllocationId:
        'allocation-existing',
      cohortId: 'cohort-2',
      unitId: 'unit-2',
      trainerId: 'trainer-1',
      workingDayId: 'day-1',
      startTimeSlotId: 'slot-1',
      endTimeSlotId: 'slot-2',
      roomId: 'room-2',
      sessionNumber: 1,
      deliveryMode: 'theory',
      status: 'locked',
      source: 'manual',
      conflictState: 'clear',
      isLocked: true,
    };

    input.existingSessions = [
      existing,
    ];

    const result =
      generateTimetablePlan(input);

    expect(result.sessions).toHaveLength(
      1,
    );

    expect(
      result.sessions[0]
        .workingDayId,
    ).toBe('day-2');
  });

  it('generates deterministic placements', () => {
    const input =
      createPlannerInput();

    const first =
      generateTimetablePlan(input);

    const second =
      generateTimetablePlan(input);

    expect(
      first.sessions.map(
        (session) => ({
          workingDayId:
            session.workingDayId,
          startTimeSlotId:
            session.startTimeSlotId,
          endTimeSlotId:
            session.endTimeSlotId,
          roomId:
            session.roomId,
        }),
      ),
    ).toEqual(
      second.sessions.map(
        (session) => ({
          workingDayId:
            session.workingDayId,
          startTimeSlotId:
            session.startTimeSlotId,
          endTimeSlotId:
            session.endTimeSlotId,
          roomId:
            session.roomId,
        }),
      ),
    );
  });

  it('returns no blocking conflicts for a valid generated plan', () => {
    const result =
      generateTimetablePlan(
        createPlannerInput(),
      );

    expect(
      result.conflicts.filter(
        (conflict) =>
          conflict.severity ===
          'blocked',
      ),
    ).toHaveLength(0);
  });
});