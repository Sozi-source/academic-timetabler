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

  it('places a selected-time trainer only in fully checked periods', () => {
    const input = createPlannerInput();
    input.trainers[0].availabilityMode = 'selected_slots_only';
    input.trainers[0].availableSlots = [
      {
        workingDayId: 'day-2',
        timeSlotId: 'slot-1',
      },
      {
        workingDayId: 'day-2',
        timeSlotId: 'slot-2',
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].workingDayId).toBe('day-2');
    expect(result.sessions[0].startTimeSlotId).toBe('slot-1');
    expect(result.sessions[0].endTimeSlotId).toBe('slot-2');
  });

  it('obeys hard institutional unavailability during generation', () => {
    const input = createPlannerInput();
    input.constraints = [{
      id: 'constraint-1',
      academicPeriodId: 'period-1',
      subjectType: 'institution',
      subjectId: null,
      constraintType: 'unavailable',
      workingDayId: 'day-1',
      startsAt: null,
      endsAt: null,
      priority: 'hard',
      reason: 'Protected institutional day',
      isActive: true,
    }];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions[0].workingDayId).toBe('day-2');
  });

  it('uses a soft preferred window when a valid preferred placement exists', () => {
    const input = createPlannerInput();
    input.constraints = [{
      id: 'constraint-1',
      academicPeriodId: 'period-1',
      subjectType: 'trainer',
      subjectId: 'trainer-1',
      constraintType: 'preferred',
      workingDayId: 'day-2',
      startsAt: null,
      endsAt: null,
      priority: 'soft',
      reason: 'Trainer prefers Tuesday',
      isActive: true,
    }];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions[0].workingDayId).toBe('day-2');
  });

  it('rejects a placement above the trainer absolute weekly maximum', () => {
    const input = createPlannerInput();
    input.trainers[0].normalWeeklyHours = 1;
    input.trainers[0].maximumWeeklyHours = 1;

    const result = generateTimetablePlan(input);

    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].conflictTypes).toContain(
      'trainer_weekly_workload',
    );
  });

  it('places a fixed Friday double session in the same room', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          weeklySessions: 2,
          fixedWorkingDayId: 'day-friday',
          fixedTimeSlotIds: [
            'slot-morning',
            'slot-mid-morning',
          ],
        },
      ],
    });

    input.workingDays.push({
      id: 'day-friday',
      academicPeriodId: 'period-1',
      dayOfWeek: 'friday',
      sequenceNumber: 5,
      isEnabled: true,
    });

    input.timeSlots = [
      {
        id: 'slot-morning',
        academicPeriodId: 'period-1',
        code: 'MORNING',
        name: 'Morning',
        slotType: 'teaching',
        startsAt: '08:00:00',
        endsAt: '10:00:00',
        sequenceNumber: 1,
        isEnabled: true,
      },
      {
        id: 'slot-mid-morning',
        academicPeriodId: 'period-1',
        code: 'MID',
        name: 'Mid-morning',
        slotType: 'teaching',
        startsAt: '10:30:00',
        endsAt: '12:30:00',
        sequenceNumber: 2,
        isEnabled: true,
      },
      {
        id: 'slot-afternoon',
        academicPeriodId: 'period-1',
        code: 'AFTERNOON',
        name: 'Afternoon',
        slotType: 'teaching',
        startsAt: '14:00:00',
        endsAt: '16:00:00',
        sequenceNumber: 3,
        isEnabled: true,
      },
    ];

    const result = generateTimetablePlan(input);
    const generated = result.sessions.filter(
      (session) => session.source === 'generator',
    );

    expect(result.unscheduled).toHaveLength(0);
    expect(generated).toHaveLength(2);
    expect(
      generated.map((session) => session.workingDayId),
    ).toEqual(['day-friday', 'day-friday']);
    expect(
      generated.map((session) => session.startTimeSlotId),
    ).toEqual(['slot-morning', 'slot-mid-morning']);
    expect(new Set(generated.map((session) => session.roomId)).size).toBe(1);
  });

  it('places Clinical Rotation as one full-day 08:00–16:00 session', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          deliveryMode: 'clinical',
          weeklySessions: 1,
          sessionDurationMinutes: 480,
          fixedWorkingDayId: 'day-1',
          fixedTimeSlotIds: ['slot-morning'],
          isFullDaySession: true,
          fixedEndTimeSlotId: 'slot-afternoon',
        },
      ],
    });

    input.timeSlots = [
      {
        id: 'slot-morning',
        academicPeriodId: 'period-1',
        code: 'MORNING',
        name: 'Morning',
        slotType: 'teaching',
        startsAt: '08:00:00',
        endsAt: '10:00:00',
        sequenceNumber: 1,
        isEnabled: true,
      },
      {
        id: 'slot-mid-morning',
        academicPeriodId: 'period-1',
        code: 'MID',
        name: 'Mid-morning',
        slotType: 'teaching',
        startsAt: '10:30:00',
        endsAt: '12:30:00',
        sequenceNumber: 2,
        isEnabled: true,
      },
      {
        id: 'slot-afternoon',
        academicPeriodId: 'period-1',
        code: 'AFTERNOON',
        name: 'Afternoon',
        slotType: 'teaching',
        startsAt: '14:00:00',
        endsAt: '16:00:00',
        sequenceNumber: 3,
        isEnabled: true,
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      workingDayId: 'day-1',
      startTimeSlotId: 'slot-morning',
      endTimeSlotId: 'slot-afternoon',
      sessionNumber: 1,
    });
  });

  it('keeps an unfixed remaining session on another day', () => {
    const result = generateTimetablePlan(
      createPlannerInput({
        allocations: [
          {
            ...baseAllocation,
            weeklySessions: 2,
            fixedWorkingDayId: 'day-1',
            fixedTimeSlotIds: ['slot-1'],
          },
        ],
      }),
    );

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].workingDayId).toBe('day-1');
    expect(result.sessions[0].startTimeSlotId).toBe('slot-1');
    expect(result.sessions[1].workingDayId).toBe('day-2');
  });

  it('places fixed weekly sessions on Monday and Wednesday at the same time', () => {
    const input = createPlannerInput({
        allocations: [
          {
            ...baseAllocation,
            weeklySessions: 2,
            fixedWorkingDayId: 'day-1',
            fixedWorkingDayIds: ['day-1', 'day-2'],
            fixedTimeSlotIds: ['slot-1', 'slot-1'],
          },
        ],
      });
    input.workingDays[1].dayOfWeek = 'wednesday';

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);
    expect(
      result.sessions.map((session) => ({
        day: session.workingDayId,
        slot: session.startTimeSlotId,
      })),
    ).toEqual([
      { day: 'day-1', slot: 'slot-1' },
      { day: 'day-2', slot: 'slot-1' },
    ]);
  });

  it('reserves a fixed session before a flexible session can take its resources', () => {
    const result = generateTimetablePlan(
      createPlannerInput({
        allocations: [
          {
            ...baseAllocation,
            id: 'allocation-a-flexible',
          },
          {
            ...baseAllocation,
            id: 'allocation-z-fixed',
            fixedWorkingDayId: 'day-1',
            fixedWorkingDayIds: ['day-1'],
            fixedTimeSlotIds: ['slot-1'],
          },
        ],
      }),
    );

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);

    expect(
      result.sessions.find(
        (session) =>
          session.teachingAllocationId ===
          'allocation-z-fixed',
      ),
    ).toMatchObject({
      workingDayId: 'day-1',
      startTimeSlotId: 'slot-1',
      endTimeSlotId: 'slot-2',
    });

    expect(
      result.sessions.find(
        (session) =>
          session.teachingAllocationId ===
          'allocation-a-flexible',
      )?.workingDayId,
    ).toBe('day-2');
  });

  it('reserves fixed Tuesday and Thursday sessions while the trainer is pending', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          trainerId: null,
          weeklySessions: 2,
          fixedWorkingDayId: 'day-1',
          fixedWorkingDayIds: ['day-1', 'day-2'],
          fixedTimeSlotIds: ['slot-1', 'slot-1'],
        },
      ],
    });
    input.workingDays[0].dayOfWeek = 'tuesday';
    input.workingDays[1].dayOfWeek = 'thursday';

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions.every(
      (session) => session.trainerId === null,
    )).toBe(true);
    expect(result.sessions.map((session) => session.workingDayId)).toEqual([
      'day-1',
      'day-2',
    ]);
    expect(result.conflicts.every(
      (conflict) => conflict.type === 'trainer_pending' && conflict.severity === 'warning',
    )).toBe(true);
  });

  it('automatically places an unfixed unit while its trainer is unassigned', () => {
    const result = generateTimetablePlan(
      createPlannerInput({
        allocations: [
          {
            ...baseAllocation,
            trainerId: null,
            weeklySessions: 2,
          },
        ],
      }),
    );

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions.every(
      (session) => session.trainerId === null,
    )).toBe(true);
    expect(new Set(result.sessions.map(
      (session) => session.workingDayId,
    )).size).toBe(2);
    expect(result.conflicts.filter(
      (conflict) => conflict.type === 'trainer_pending',
    )).toHaveLength(2);
    expect(result.conflicts.some(
      (conflict) => conflict.severity === 'blocked',
    )).toBe(false);
  });

  it('does not leave half of a fixed double session scheduled', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          weeklySessions: 2,
          fixedWorkingDayId: 'day-1',
          fixedTimeSlotIds: ['slot-morning', 'slot-mid-morning'],
        },
      ],
    });

    input.timeSlots = [
      {
        id: 'slot-morning',
        academicPeriodId: 'period-1',
        code: 'MORNING',
        name: 'Morning',
        slotType: 'teaching',
        startsAt: '08:00:00',
        endsAt: '10:00:00',
        sequenceNumber: 1,
        isEnabled: true,
      },
      {
        id: 'slot-mid-morning',
        academicPeriodId: 'period-1',
        code: 'MID',
        name: 'Mid-morning',
        slotType: 'teaching',
        startsAt: '10:30:00',
        endsAt: '12:30:00',
        sequenceNumber: 2,
        isEnabled: true,
      },
    ];

    input.trainers[0].maximumDailyHours = 2;

    const result = generateTimetablePlan(input);

    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(2);
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

  it('reports sessions that cannot fit an explicitly preferred room', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          preferredRoomId: 'room-1',
        },
      ],
    });

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

  it('schedules without a room when no room is assigned', () => {
    const input = createPlannerInput();
    input.rooms = [];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].roomId).toBeNull();
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

  it('does not regenerate a session request already satisfied by an existing session', () => {
    const input = createPlannerInput();

    input.existingSessions = [
      {
        id: 'existing-allocation-session',
        academicPeriodId: 'period-1',
        teachingAllocationId:
          baseAllocation.id,
        cohortId:
          baseAllocation.cohortId,
        unitId: baseAllocation.unitId,
        trainerId:
          baseAllocation.trainerId,
        workingDayId: 'day-1',
        startTimeSlotId: 'slot-1',
        endTimeSlotId: 'slot-2',
        roomId: null,
        sessionNumber: 1,
        deliveryMode: 'theory',
        status: 'draft',
        source: 'generator',
        conflictState: 'clear',
        isLocked: false,
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(0);
    expect(
      result.statistics.requestedSessionCount,
    ).toBe(0);
  });

  it('does not treat a stale session at the wrong fixed time as satisfying the allocation', () => {
    const input = createPlannerInput({
      allocations: [{
        ...baseAllocation,
        fixedWorkingDayId: 'day-2',
        fixedWorkingDayIds: ['day-2'],
        fixedTimeSlotIds: ['slot-1'],
      }],
    });

    input.existingSessions = [{
      id: 'stale-fixed-session',
      academicPeriodId: 'period-1',
      teachingAllocationId: baseAllocation.id,
      cohortId: baseAllocation.cohortId,
      unitId: baseAllocation.unitId,
      trainerId: baseAllocation.trainerId,
      workingDayId: 'day-1',
      startTimeSlotId: 'slot-1',
      endTimeSlotId: 'slot-2',
      roomId: null,
      sessionNumber: 1,
      deliveryMode: 'theory',
      status: 'locked',
      source: 'manual',
      conflictState: 'clear',
      isLocked: true,
    }];

    const result = generateTimetablePlan(input);

    expect(result.statistics.requestedSessionCount).toBe(1);
    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].conflictTypes).toContain('duplicate_session');
  });

  it('does not treat a session with the previous trainer as satisfying the allocation', () => {
    const input = createPlannerInput({
      allocations: [{
        ...baseAllocation,
        trainerId: 'trainer-borrowed',
      }],
    });
    input.trainers.push({
      ...input.trainers[0],
      id: 'trainer-borrowed',
      staffNumber: 'BORROWED-1',
      fullName: 'Borrowed Trainer',
    });
    input.existingSessions = [{
      id: 'session-with-previous-trainer',
      academicPeriodId: 'period-1',
      teachingAllocationId: baseAllocation.id,
      cohortId: baseAllocation.cohortId,
      unitId: baseAllocation.unitId,
      trainerId: baseAllocation.trainerId,
      workingDayId: 'day-1',
      startTimeSlotId: 'slot-1',
      endTimeSlotId: 'slot-2',
      roomId: null,
      sessionNumber: 1,
      deliveryMode: 'theory',
      status: 'locked',
      source: 'manual',
      conflictState: 'clear',
      isLocked: true,
    }];

    const result = generateTimetablePlan(input);

    expect(result.statistics.requestedSessionCount).toBe(1);
    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].conflictTypes).toContain('duplicate_session');
  });

  it('preserves a satisfied locked session and generates only the missing weekly session', () => {
    const input = createPlannerInput({
      allocations: [
        {
          ...baseAllocation,
          weeklySessions: 2,
        },
      ],
    });

    input.existingSessions = [
      {
        id: 'locked-session-one',
        academicPeriodId: 'period-1',
        teachingAllocationId:
          baseAllocation.id,
        cohortId:
          baseAllocation.cohortId,
        unitId: baseAllocation.unitId,
        trainerId:
          baseAllocation.trainerId,
        workingDayId: 'day-1',
        startTimeSlotId: 'slot-1',
        endTimeSlotId: 'slot-2',
        roomId: null,
        sessionNumber: 1,
        deliveryMode: 'theory',
        status: 'locked',
        source: 'manual',
        conflictState: 'clear',
        isLocked: true,
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      teachingAllocationId:
        baseAllocation.id,
      sessionNumber: 2,
      workingDayId: 'day-2',
    });
    expect(
      result.statistics.requestedSessionCount,
    ).toBe(1);
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
