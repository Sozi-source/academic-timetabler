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

    expect(result.unscheduled[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'insufficient_room_capacity',
          rejectedCandidateCount: 4,
          candidateWindows: expect.arrayContaining([
            'Monday S1 (08:00–10:00)',
          ]),
          suggestion: expect.stringContaining(
            'suitable room',
          ),
        }),
      ]),
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

  it('prioritizes allocations from other-department trainers with restricted schedules to prevent unscheduled collisions', () => {
    const input = createPlannerInput({
      allocations: [
        {
          id: 'allocation-internal',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-1',
          trainerId: 'trainer-internal',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'allocation-ondieki',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-2',
          trainerId: 'trainer-ondieki',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
      ],
    });

    input.units.push({
      id: 'unit-2',
      code: 'ICT 201',
      name: 'ICT Systems',
      preferredRoomType: null,
      isActive: true,
      isTimetableAvailable: true,
    });

    input.trainers = [
      {
        id: 'trainer-internal',
        departmentId: 'department-1',
        staffNumber: 'ST-001',
        fullName: 'Internal Trainer',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
      {
        id: 'trainer-ondieki',
        departmentId: 'department-2', // Other department / guest trainer
        staffNumber: 'ST-OND',
        fullName: 'Brian Ondieki',
        normalWeeklyHours: 10,
        maximumWeeklyHours: 15,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'selected_slots_only',
        availableSlots: [
          { workingDayId: 'day-1', timeSlotId: 'slot-1' },
          { workingDayId: 'day-1', timeSlotId: 'slot-2' },
        ],
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);

    const ondiekiSession = result.sessions.find(
      (s) => s.teachingAllocationId === 'allocation-ondieki',
    );
    expect(ondiekiSession).toBeDefined();
    expect(ondiekiSession?.workingDayId).toBe('day-1');
    expect(ondiekiSession?.startTimeSlotId).toBe('slot-1');
    expect(ondiekiSession?.endTimeSlotId).toBe('slot-2');

    const internalSession = result.sessions.find(
      (s) => s.teachingAllocationId === 'allocation-internal',
    );
    expect(internalSession).toBeDefined();
    expect(internalSession?.workingDayId).not.toBe('day-1');
  });

  it('prioritizes other-department guest trainers with fixed slot allocations over general internal allocations', () => {
    const input = createPlannerInput({
      allocations: [
        {
          id: 'allocation-internal-flexible',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-1',
          trainerId: 'trainer-internal',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'allocation-guest-fixed',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-2',
          trainerId: 'trainer-guest',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
          fixedWorkingDayId: 'day-1',
          fixedTimeSlotIds: ['slot-1'],
        },
      ],
    });

    input.units.push({
      id: 'unit-2',
      code: 'MED 202',
      name: 'Clinical Practice',
      preferredRoomType: null,
      isActive: true,
      isTimetableAvailable: true,
    });

    input.trainers = [
      {
        id: 'trainer-internal',
        departmentId: 'department-1',
        staffNumber: 'ST-001',
        fullName: 'Internal Trainer',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
      {
        id: 'trainer-guest',
        departmentId: 'department-2',
        staffNumber: 'ST-GST',
        fullName: 'Guest Trainer',
        normalWeeklyHours: 10,
        maximumWeeklyHours: 15,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);

    const guestSession = result.sessions.find(
      (s) => s.teachingAllocationId === 'allocation-guest-fixed',
    );
    expect(guestSession?.workingDayId).toBe('day-1');
    expect(guestSession?.startTimeSlotId).toBe('slot-1');
  });

  it('prioritizes multi-cohort shared classes before individual cohort sessions to prevent calendar exhaustion', () => {
    const input = createPlannerInput({
      allocations: [
        {
          id: 'alloc-cnd-individual',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-1',
          trainerId: 'trainer-1',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'alloc-dhn-individual',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-2',
          unitId: 'unit-2',
          trainerId: 'trainer-1',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'alloc-shared-nutrition',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-nutrition',
          trainerId: 'trainer-2',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
          participantCohortIds: ['cohort-1', 'cohort-2', 'cohort-3'],
        },
      ],
    });

    input.cohorts.push(
      { id: 'cohort-2', code: 'DHN-25', name: 'DHN Jan 25', actualSize: 30, isTimetableAvailable: true },
      { id: 'cohort-3', code: 'CHN-25', name: 'CHN May 25', actualSize: 25, isTimetableAvailable: true },
    );

    input.units.push(
      { id: 'unit-2', code: 'DHN 2303', name: 'Diet Therapy', preferredRoomType: null, isActive: true, isTimetableAvailable: true },
      { id: 'unit-nutrition', code: 'NUT 101', name: 'Nutrition in the Lifespan', preferredRoomType: null, isActive: true, isTimetableAvailable: true },
    );

    input.trainers.push({
      id: 'trainer-2',
      departmentId: 'department-1',
      staffNumber: 'ST-002',
      fullName: 'Martin Wanjohi',
      normalWeeklyHours: 20,
      maximumWeeklyHours: 25,
      maximumDailyHours: 8,
      isActive: true,
      isTimetableAvailable: true,
      availabilityMode: 'generally_available',
    });

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(3);

    const sharedSession = result.sessions.find((s) => s.teachingAllocationId === 'alloc-shared-nutrition');
    expect(sharedSession).toBeDefined();

    // Verify no cohort overlap between individual sessions and shared session
    for (const session of result.sessions) {
      if (session.id !== sharedSession?.id) {
        expect(
          session.workingDayId === sharedSession?.workingDayId &&
          session.startTimeSlotId === sharedSession?.startTimeSlotId,
        ).toBe(false);
      }
    }
  });

  it('automatically relocates a flexible conflicting class to another open time when a constrained class needs the slot', () => {
    // 2 working days (day-1 and day-2), 1 time slot (slot-1 to slot-2)
    // Trainer A (flexible) is scheduled.
    // Trainer B (constrained to day-1 only via availability) arrives later.
    // The scheduler relocates Trainer A to day-2 and places Trainer B on day-1.
    const input = createPlannerInput({
      allocations: [
        {
          id: 'alloc-flexible',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-1',
          trainerId: 'trainer-flex',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'alloc-constrained',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-2',
          trainerId: 'trainer-const',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
      ],
    });

    input.units.push({
      id: 'unit-2',
      code: 'UNIT-2',
      name: 'Constrained Unit',
      preferredRoomType: null,
      isActive: true,
      isTimetableAvailable: true,
    });

    input.trainers = [
      {
        id: 'trainer-flex',
        departmentId: 'department-1',
        staffNumber: 'ST-FLX',
        fullName: 'Flexible Trainer',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
      {
        id: 'trainer-const',
        departmentId: 'department-1',
        staffNumber: 'ST-CST',
        fullName: 'Constrained Trainer',
        normalWeeklyHours: 10,
        maximumWeeklyHours: 15,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'selected_slots_only',
        availableSlots: [
          { workingDayId: 'day-1', timeSlotId: 'slot-1' },
          { workingDayId: 'day-1', timeSlotId: 'slot-2' },
        ],
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);

    const constrainedSession = result.sessions.find((s) => s.teachingAllocationId === 'alloc-constrained');
    const flexibleSession = result.sessions.find((s) => s.teachingAllocationId === 'alloc-flexible');

    expect(constrainedSession?.workingDayId).toBe('day-1');
    expect(flexibleSession?.workingDayId).toBe('day-2');
  });

  it('relocates multiple flexible single-cohort classes to accommodate a multi-cohort shared class', () => {
    // 3 working days (day-1, day-2, day-3), 1 time slot (slot-1 to slot-2)
    // 2 single-cohort flexible sessions occupy day-1 for cohort-1 and cohort-2.
    // A shared class across [cohort-1, cohort-2] arrives and needs day-1 (e.g. trainer only available day-1).
    // Schedular displaces both single-cohort sessions and relocates them to day-2 and day-3.
    const input = createPlannerInput({
      allocations: [
        {
          id: 'alloc-flex-1',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-1',
          trainerId: 'trainer-flex-1',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'alloc-flex-2',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-2',
          unitId: 'unit-2',
          trainerId: 'trainer-flex-2',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
        },
        {
          id: 'alloc-shared-const',
          academicPeriodId: 'period-1',
          cohortId: 'cohort-1',
          unitId: 'unit-shared',
          trainerId: 'trainer-shared',
          preferredRoomId: null,
          deliveryMode: 'theory',
          weeklySessions: 1,
          sessionDurationMinutes: 120,
          isTimetableEnabled: true,
          participantCohortIds: ['cohort-1', 'cohort-2'],
        },
      ],
    });

    input.workingDays.push({
      id: 'day-3',
      academicPeriodId: 'period-1',
      dayOfWeek: 'Wednesday',
      sequenceNumber: 3,
      isEnabled: true,
    });

    input.cohorts.push({
      id: 'cohort-2',
      code: 'COHORT-2',
      name: 'Cohort 2',
      actualSize: 20,
      isTimetableAvailable: true,
    });

    input.units.push(
      { id: 'unit-2', code: 'UNIT-2', name: 'Unit 2', preferredRoomType: null, isActive: true, isTimetableAvailable: true },
      { id: 'unit-shared', code: 'NUT 101', name: 'Nutrition in the Lifespan', preferredRoomType: null, isActive: true, isTimetableAvailable: true },
    );

    input.trainers = [
      {
        id: 'trainer-flex-1',
        departmentId: 'department-1',
        staffNumber: 'ST-1',
        fullName: 'Flex 1',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
      {
        id: 'trainer-flex-2',
        departmentId: 'department-1',
        staffNumber: 'ST-2',
        fullName: 'Flex 2',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'generally_available',
      },
      {
        id: 'trainer-shared',
        departmentId: 'department-1',
        staffNumber: 'ST-SH',
        fullName: 'Martin Wanjohi',
        normalWeeklyHours: 20,
        maximumWeeklyHours: 25,
        maximumDailyHours: 8,
        isActive: true,
        isTimetableAvailable: true,
        availabilityMode: 'selected_slots_only',
        availableSlots: [
          { workingDayId: 'day-1', timeSlotId: 'slot-1' },
          { workingDayId: 'day-1', timeSlotId: 'slot-2' },
        ],
      },
    ];

    const result = generateTimetablePlan(input);

    expect(result.unscheduled).toHaveLength(0);
    expect(result.sessions).toHaveLength(3);

    const sharedSession = result.sessions.find((s) => s.teachingAllocationId === 'alloc-shared-const');
    const flex1Session = result.sessions.find((s) => s.teachingAllocationId === 'alloc-flex-1');
    const flex2Session = result.sessions.find((s) => s.teachingAllocationId === 'alloc-flex-2');

    expect(sharedSession?.workingDayId).toBe('day-1');
    expect(flex1Session?.workingDayId).not.toBe('day-1');
    expect(flex2Session?.workingDayId).not.toBe('day-1');
  });
});

