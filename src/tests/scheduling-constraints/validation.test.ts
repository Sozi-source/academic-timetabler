import { describe, expect, it } from 'vitest';

import {
  schedulingConstraintSchema,
  timetableCalendarEventSchema,
} from '@/features/scheduling-constraints/validation';

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

  it('accepts trainer constraints', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        subjectType: 'trainer',
      }).success,
    ).toBe(true);
  });

  it('accepts preferred, required, and protected_day rules', () => {
    for (const constraintType of ['preferred', 'required', 'protected_day'] as const) {
      expect(
        schedulingConstraintSchema.safeParse({
          ...valid,
          constraintType,
        }).success,
      ).toBe(true);
    }
  });

  it('accepts soft priority', () => {
    expect(
      schedulingConstraintSchema.safeParse({
        ...valid,
        priority: 'soft',
      }).success,
    ).toBe(true);
  });
});

describe('timetableCalendarEventSchema', () => {
  const baseEvent = {
    academicPeriodId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Departmental Nutrition Seminar',
    eventType: 'seminar' as const,
    eventDate: '2027-02-12',
    scopeType: 'institution' as const,
    suspendsRegularClasses: true,
    notes: 'Guest speaker symposium',
  };

  it('accepts an institution-wide unique calendar event without scopeId', () => {
    expect(timetableCalendarEventSchema.safeParse(baseEvent).success).toBe(true);
  });

  it('requires scopeId for cohort, trainer, or room calendar events', () => {
    expect(
      timetableCalendarEventSchema.safeParse({
        ...baseEvent,
        scopeType: 'cohort',
      }).success,
    ).toBe(false);

    expect(
      timetableCalendarEventSchema.safeParse({
        ...baseEvent,
        scopeType: 'cohort',
        scopeId: '550e8400-e29b-41d4-a716-446655440004',
      }).success,
    ).toBe(true);
  });
});
