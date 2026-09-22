import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createTimeSlotLookup,
  resolveSessionInterval,
  type PlanningSession,
  type PlanningTimeSlot,
} from '@/features/timetable-generator';

const timeSlots: PlanningTimeSlot[] = [
  {
    id: 'slot-1',
    academicPeriodId: 'period-1',
    code: 'S1',
    name: 'First session',
    slotType: 'teaching',
    startsAt: '08:00:00',
    endsAt: '09:00:00',
    sequenceNumber: 1,
    isEnabled: true,
  },
  {
    id: 'slot-2',
    academicPeriodId: 'period-1',
    code: 'S2',
    name: 'Second session',
    slotType: 'teaching',
    startsAt: '09:00:00',
    endsAt: '10:00:00',
    sequenceNumber: 2,
    isEnabled: true,
  },
];

const session: PlanningSession = {
  id: 'session-1',
  academicPeriodId: 'period-1',
  teachingAllocationId: 'allocation-1',
  cohortId: 'cohort-1',
  unitId: 'unit-1',
  trainerId: 'trainer-1',
  workingDayId: 'day-1',
  startTimeSlotId: 'slot-1',
  endTimeSlotId: 'slot-2',
  roomId: 'room-1',
  sessionNumber: 1,
  deliveryMode: 'theory',
  status: 'draft',
  source: 'generator',
  conflictState: 'unchecked',
  isLocked: false,
};

describe('resolveSessionInterval', () => {
  it('uses the start slot start and end slot end', () => {
    const interval =
      resolveSessionInterval({
        session,
        timeSlots:
          createTimeSlotLookup(
            timeSlots,
          ),
      });

    expect(interval).toEqual({
      startsAt: '08:00:00',
      endsAt: '10:00:00',
    });
  });

  it('throws when the start slot is missing', () => {
    expect(() =>
      resolveSessionInterval({
        session: {
          ...session,
          startTimeSlotId:
            'missing-slot',
        },
        timeSlots:
          createTimeSlotLookup(
            timeSlots,
          ),
      }),
    ).toThrow(
      'Start time slot "missing-slot" was not found',
    );
  });

  it('throws when the end slot is missing', () => {
    expect(() =>
      resolveSessionInterval({
        session: {
          ...session,
          endTimeSlotId:
            'missing-slot',
        },
        timeSlots:
          createTimeSlotLookup(
            timeSlots,
          ),
      }),
    ).toThrow(
      'End time slot "missing-slot" was not found',
    );
  });
});