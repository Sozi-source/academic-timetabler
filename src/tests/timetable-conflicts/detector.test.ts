import { describe, expect, it } from 'vitest';

import { detectTimetableConflictCenter } from '@/features/timetable-conflicts/detector';
import type { ConflictSession } from '@/features/timetable-conflicts/types';

const base: ConflictSession = {
  id: 'a',
  teachingAllocationId: 'ta',
  cohortId: 'c1',
  cohortName: 'Cohort 1',
  cohortSize: 40,
  unitId: 'u1',
  unitCode: 'U1',
  unitName: 'Unit 1',
  trainerId: 't1',
  trainerName: 'Trainer 1',
  roomId: 'r1',
  roomCode: 'R1',
  roomName: 'Room 1',
  roomCapacity: 50,
  workingDayId: 'd1',
  workingDayLabel: 'Monday',
  startTimeSlotId: 's1',
  startTime: '08:00:00',
  endTimeSlotId: 's2',
  endTime: '10:00:00',
  status: 'draft',
  conflictState: 'clear',
  isLocked: false,
};

describe('conflict centre detector', () => {
  it('detects trainer and room overlaps', () => {
    const second: ConflictSession = {
      ...base,
      id: 'b',
      teachingAllocationId: 'tb',
      cohortId: 'c2',
      cohortName: 'Cohort 2',
      unitId: 'u2',
      unitCode: 'U2',
    };

    const conflicts = detectTimetableConflictCenter([base, second], [], []);

    expect(conflicts.some((item) => item.kind === 'trainer_overlap')).toBe(true);
    expect(conflicts.some((item) => item.kind === 'room_overlap')).toBe(true);
  });

  it('does not flag compatible shared classes', () => {
    const second: ConflictSession = {
      ...base,
      id: 'b',
      teachingAllocationId: 'tb',
      cohortId: 'c2',
      cohortName: 'Cohort 2',
    };

    expect(detectTimetableConflictCenter([base, second], [], [])).toHaveLength(0);
  });

  it('detects capacity and hard constraints', () => {
    const session: ConflictSession = { ...base, roomCapacity: 20 };
    const conflicts = detectTimetableConflictCenter(
      [session],
      [{
        id: 'x',
        subjectType: 'cohort',
        subjectId: 'c1',
        constraintType: 'protected_day',
        workingDayId: 'd1',
        startsAt: null,
        endsAt: null,
        priority: 'hard',
        reason: 'Clinical rotation day.',
      }],
      [],
    );

    expect(conflicts.some((item) => item.kind === 'room_capacity')).toBe(true);
    expect(conflicts.some((item) => item.kind === 'hard_constraint')).toBe(true);
  });
});
