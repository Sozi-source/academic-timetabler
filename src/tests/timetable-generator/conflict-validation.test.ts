import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  detectTimetableConflicts,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

function getTypes(
  input = createConflictInput(),
) {
  return detectTimetableConflicts(
    input,
  ).map((conflict) => conflict.type);
}

describe('calendar validation conflicts', () => {
  it('detects a disabled working day', () => {
    const input =
      createConflictInput();

    input.workingDays[0].isEnabled =
      false;

    expect(getTypes(input)).toContain(
      'disabled_working_day',
    );
  });

  it('detects a disabled time slot', () => {
    const input =
      createConflictInput();

    input.timeSlots[0].isEnabled =
      false;

    expect(getTypes(input)).toContain(
      'disabled_time_slot',
    );
  });

  it('detects a non-teaching time slot', () => {
    const input =
      createConflictInput();

    input.timeSlots[0].slotType =
      'break';

    expect(getTypes(input)).toContain(
      'non_teaching_time_slot',
    );
  });

  it('detects Academic Period mismatch', () => {
    const input =
      createConflictInput();

    input.workingDays[0]
      .academicPeriodId =
      'period-2';

    expect(getTypes(input)).toContain(
      'academic_period_mismatch',
    );
  });
});

describe('resource validation conflicts', () => {
  it('detects an unavailable trainer', () => {
    const input =
      createConflictInput();

    input.trainers[0].isActive =
      false;

    expect(getTypes(input)).toContain(
      'trainer_unavailable',
    );
  });

  it('requires every teaching period covered by a selected-time trainer session', () => {
    const input = createConflictInput([
      {
        ...baseSession,
        endTimeSlotId: 'slot-3',
      },
    ]);

    input.trainers[0].availabilityMode = 'selected_slots_only';
    input.trainers[0].availableSlots = [
      {
        workingDayId: 'day-1',
        timeSlotId: 'slot-1',
      },
      {
        workingDayId: 'day-1',
        timeSlotId: 'slot-3',
      },
    ];

    expect(getTypes(input)).toContain('trainer_unavailable');
  });

  it('detects an unavailable cohort', () => {
    const input =
      createConflictInput();

    input.cohorts[0]
      .isTimetableAvailable =
      false;

    expect(getTypes(input)).toContain(
      'cohort_unavailable',
    );
  });

  it('detects an unavailable room', () => {
    const input =
      createConflictInput();

    input.rooms[0]
      .isTimetableAvailable =
      false;

    expect(getTypes(input)).toContain(
      'room_unavailable',
    );
  });

  it('detects an unavailable unit', () => {
    const input =
      createConflictInput();

    input.units[0].isActive =
      false;

    expect(getTypes(input)).toContain(
      'unit_unavailable',
    );
  });

  it('detects insufficient room capacity', () => {
    const input =
      createConflictInput();

    input.rooms[0].capacity = 20;

    expect(getTypes(input)).toContain(
      'insufficient_room_capacity',
    );
  });

  it('detects incompatible room type', () => {
    const input =
      createConflictInput();

    input.rooms[0].roomType =
      'laboratory';

    expect(getTypes(input)).toContain(
      'incompatible_room_type',
    );
  });
});

describe('duplicate session detection', () => {
  it('detects repeated session numbers', () => {
    const duplicate = {
      ...baseSession,
      id: 'session-2',
    };

    expect(
      getTypes(
        createConflictInput([
          baseSession,
          duplicate,
        ]),
      ),
    ).toContain('duplicate_session');
  });
});
