import { describe, expect, it } from 'vitest';

import { detectTimetableConflictCenter } from '@/features/timetable-conflicts/detector';
import type { ConflictSession } from '@/features/timetable-conflicts/types';

const base: ConflictSession = {
  id: 'a',
  teachingAllocationId: 'ta',
  cohortId: 'c1',
  cohortName: 'Cohort 1',
  cohortSize: 40,
  participantCohortIds: ['c1'],
  combinedCohortSize: 40,
  unitId: 'u1',
  unitCode: 'U1',
  unitName: 'Unit 1',
  trainerId: 't1',
  trainerName: 'Trainer 1',
  trainerAvailabilityMode: 'generally_available',
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
      unitName: 'Unit 2',
    };

    const conflicts = detectTimetableConflictCenter([base, second], [], []);

    expect(conflicts.some((item) => item.kind === 'trainer_overlap')).toBe(true);
    expect(conflicts.some((item) => item.kind === 'room_overlap')).toBe(true);
  });

  it('blocks a full-day rotation that overlaps a shared-class cohort', () => {
    const clinicalRotation: ConflictSession = {
      ...base,
      id: 'clinical',
      teachingAllocationId: 'clinical-allocation',
      cohortId: 'clinical-primary',
      participantCohortIds: [
        'clinical-primary',
        'shared-cohort',
      ],
      unitName: 'Clinical Rotation',
      startTime: '08:00:00',
      endTime: '16:00:00',
      trainerId: 'clinical-trainer',
      roomId: null,
    };
    const anatomy: ConflictSession = {
      ...base,
      id: 'anatomy',
      teachingAllocationId: 'anatomy-allocation',
      cohortId: 'anatomy-primary',
      participantCohortIds: [
        'anatomy-primary',
        'shared-cohort',
      ],
      unitName: 'Human Anatomy and Physiology',
      startTime: '14:00:00',
      endTime: '16:00:00',
      trainerId: 'anatomy-trainer',
      roomId: 'anatomy-room',
    };

    const conflicts = detectTimetableConflictCenter(
      [clinicalRotation, anatomy],
      [],
      [],
    );

    expect(conflicts.some(
      (item) =>
        item.kind === 'cohort_overlap' &&
        item.severity === 'blocked',
    )).toBe(true);
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

  it('blocks an existing session outside a selected-time trainer availability', () => {
    const session: ConflictSession = {
      ...base,
      trainerAvailabilityMode: 'selected_slots_only',
    };

    const conflicts = detectTimetableConflictCenter(
      [session],
      [],
      [],
      {
        availableSlots: [
          {
            trainerId: 't1',
            workingDayId: 'd2',
            timeSlotId: 's1',
          },
          {
            trainerId: 't1',
            workingDayId: 'd2',
            timeSlotId: 's2',
          },
        ],
        timeSlots: [
          {
            id: 's1',
            sequenceNumber: 1,
            slotType: 'teaching',
            isEnabled: true,
          },
          {
            id: 's2',
            sequenceNumber: 2,
            slotType: 'teaching',
            isEnabled: true,
          },
        ],
      },
    );

    expect(conflicts.some(
      (item) => item.kind === 'trainer_availability' && item.severity === 'blocked',
    )).toBe(true);
  });
});
