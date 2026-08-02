import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  trainerFormSchema,
  trainerIdSchema,
} from '@/features/trainers/validation';

const validTrainer = {
  staffNumber: 'TR-001',
  fullName: 'Jane Waithera',
  email: 'jane.waithera@example.com',
  phoneNumber: '+254 712 345 678',
  employmentType: 'full_time',
  specialization:
    'Clinical Nutrition and Dietetics',
  qualifications:
    'Bachelor of Science in Human Nutrition and Dietetics',
  maximumWeeklyHours: 24,
  maximumDailyHours: 6,
  notes: 'Available for diploma-level units.',
};

describe('trainerFormSchema', () => {
  it('accepts a valid trainer', () => {
    const result =
      trainerFormSchema.safeParse(
        validTrainer,
      );

    expect(result.success).toBe(true);
  });

  it('normalizes the staff number to uppercase', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        staffNumber: 'tr-002',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.staffNumber,
      ).toBe('TR-002');
    }
  });

  it('coerces teaching hours from form strings', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        maximumWeeklyHours: '30',
        maximumDailyHours: '5',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.maximumWeeklyHours,
      ).toBe(30);

      expect(
        result.data.maximumDailyHours,
      ).toBe(5);
    }
  });

  it('rejects daily hours above weekly hours', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        maximumWeeklyHours: 5,
        maximumDailyHours: 6,
      });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid email address', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        email: 'invalid-email',
      });

    expect(result.success).toBe(false);
  });

  it('accepts optional contact fields', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        email: undefined,
        phoneNumber: undefined,
        specialization: undefined,
        qualifications: undefined,
        notes: undefined,
      });

    expect(result.success).toBe(true);
  });

  it('rejects unsupported staff-number characters', () => {
    const result =
      trainerFormSchema.safeParse({
        ...validTrainer,
        staffNumber: 'TR # 001',
      });

    expect(result.success).toBe(false);
  });
});

describe('trainerIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      trainerIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid identifier', () => {
    expect(
      trainerIdSchema.safeParse(
        'invalid-trainer-id',
      ).success,
    ).toBe(false);
  });
});