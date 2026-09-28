import { describe, expect, it } from 'vitest';

import { schedulingConstraintSchema } from '@/features/scheduling-constraints/validation';

const valid = {
  academicPeriodId: '550e8400-e29b-41d4-a716-446655440000',
  subjectType: 'room',
  subjectId: '550e8400-e29b-41d4-a716-446655440001',
  constraintType: 'unavailable',
  workingDayId: '550e8400-e29b-41d4-a716-446655440002',
  timeSlotId: '550e8400-e29b-41d4-a716-446655440003',
  priority: 'hard',
  reason: 'Room unavailable.',
};

describe('schedulingConstraintSchema', () => {
  it('accepts a room teaching-session restriction', () => {
    expect(schedulingConstraintSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an all-day restriction without a time slot', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        timeSlotId: undefined,
      }).success,
    ).toBe(true);
  });

  it('requires a record for room or cohort restrictions', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        subjectId: undefined,
      }).success,
    ).toBe(false);
  });

  it('accepts institution-wide restrictions without a subject id', () => {
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
      schedulingConstraintSchema.safeParse({
        ...valid,
        reason: '',
      }).success,
    ).toBe(true);
  });

  it('rejects trainer constraints', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        subjectType: 'trainer',
      }).success,
    ).toBe(false);
  });

  it('rejects preferred and required rules', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        constraintType: 'preferred',
      }).success,
    ).toBe(false);

    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        constraintType: 'required',
      }).success,
    ).toBe(false);
  });

  it('rejects soft priority', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        priority: 'soft',
      }).success,
    ).toBe(false);
  });
});
