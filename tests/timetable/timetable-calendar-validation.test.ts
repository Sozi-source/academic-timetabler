import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  timeSlotFormSchema,
  workingDayFormSchema,
} from '@/features/timetable-calendar/validation';

const academicPeriodId =
  '550e8400-e29b-41d4-a716-446655440000';

describe('workingDayFormSchema', () => {
  it('accepts a valid Working Day', () => {
    const result =
      workingDayFormSchema.safeParse({
        academicPeriodId,
        dayOfWeek: 'monday',
        sequenceNumber: 1,
        notes: 'Normal teaching day.',
      });

    expect(result.success).toBe(true);
  });

  it('rejects a sequence outside one to seven', () => {
    const result =
      workingDayFormSchema.safeParse({
        academicPeriodId,
        dayOfWeek: 'monday',
        sequenceNumber: 8,
      });

    expect(result.success).toBe(false);
  });
});

describe('timeSlotFormSchema', () => {
  it('accepts a valid teaching slot', () => {
    const result =
      timeSlotFormSchema.safeParse({
        academicPeriodId,
        name: 'Lesson 1',
        code: 'L1',
        slotType: 'teaching',
        startsAt: '08:00',
        endsAt: '09:00',
        sequenceNumber: 1,
      });

    expect(result.success).toBe(true);
  });

  it('normalizes the code to uppercase', () => {
    const result =
      timeSlotFormSchema.safeParse({
        academicPeriodId,
        name: 'Morning lesson',
        code: 'lesson-1',
        slotType: 'teaching',
        startsAt: '08:00',
        endsAt: '09:00',
        sequenceNumber: 1,
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'LESSON-1',
      );
    }
  });

  it('rejects an end time before the start time', () => {
    const result =
      timeSlotFormSchema.safeParse({
        academicPeriodId,
        name: 'Invalid lesson',
        code: 'INVALID',
        slotType: 'teaching',
        startsAt: '10:00',
        endsAt: '09:00',
        sequenceNumber: 1,
      });

    expect(result.success).toBe(false);
  });

  it('rejects invalid 24-hour times', () => {
    const result =
      timeSlotFormSchema.safeParse({
        academicPeriodId,
        name: 'Invalid time',
        code: 'INVALID',
        slotType: 'teaching',
        startsAt: '25:00',
        endsAt: '26:00',
        sequenceNumber: 1,
      });

    expect(result.success).toBe(false);
  });

  it('accepts a break slot', () => {
    const result =
      timeSlotFormSchema.safeParse({
        academicPeriodId,
        name: 'Morning break',
        code: 'BREAK',
        slotType: 'break',
        startsAt: '10:00',
        endsAt: '10:30',
        sequenceNumber: 3,
      });

    expect(result.success).toBe(true);
  });
});