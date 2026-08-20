import { describe, expect, it } from 'vitest';

import { schedulingConstraintSchema } from '@/features/scheduling-constraints/validation';

const valid = {
  academicPeriodId: '550e8400-e29b-41d4-a716-446655440000',
  subjectType: 'trainer',
  subjectId: '550e8400-e29b-41d4-a716-446655440001',
  constraintType: 'unavailable',
  workingDayId: '550e8400-e29b-41d4-a716-446655440002',
  timeSlotId: '550e8400-e29b-41d4-a716-446655440003',
  priority: 'hard',
  reason: 'Trainer unavailable.',
};

describe('schedulingConstraintSchema', () => {
  it('accepts a teaching-session constraint', () => {
    expect(schedulingConstraintSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an all-day constraint without a time slot', () => {
    expect(
      schedulingConstraintSchema.safeParse({ ...valid, timeSlotId: undefined })
        .success,
    ).toBe(true);
  });

  it('requires a subject except institution', () => {
    expect(
      schedulingConstraintSchema.safeParse({ ...valid, subjectId: undefined })
        .success,
    ).toBe(false);
  });

  it('accepts institution-wide rules without a subject id', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        subjectType: 'institution',
        subjectId: undefined,
      }).success,
    ).toBe(true);
  });

  it('allows an optional reason', () => {
    expect(
      schedulingConstraintSchema.safeParse({ ...valid, reason: '' }).success,
    ).toBe(true);
  });
});
