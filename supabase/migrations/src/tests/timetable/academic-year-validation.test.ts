import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  academicYearFormSchema,
  academicYearIdSchema,
} from '@/features/academic-years/validation';

describe('academicYearFormSchema', () => {
  it('accepts a valid Academic Year', () => {
    const result =
      academicYearFormSchema.safeParse({
        name: '2026 Academic Year',
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
        notes: 'Institutional academic calendar.',
      });

    expect(result.success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    const result =
      academicYearFormSchema.safeParse({
        name: '2026 Academic Year',
        startsOn: '2026-12-31',
        endsOn: '2026-01-01',
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.endsOn,
      ).toContain(
        'The end date must be after the start date.',
      );
    }
  });

  it('rejects impossible dates', () => {
    const result =
      academicYearFormSchema.safeParse({
        name: '2026 Academic Year',
        startsOn: '2026-02-30',
        endsOn: '2026-12-31',
      });

    expect(result.success).toBe(false);
  });

  it('rejects notes exceeding one thousand characters', () => {
    const result =
      academicYearFormSchema.safeParse({
        name: '2026 Academic Year',
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
        notes: 'A'.repeat(1001),
      });

    expect(result.success).toBe(false);
  });
});

describe('academicYearIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      academicYearIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid identifier', () => {
    expect(
      academicYearIdSchema.safeParse(
        'not-a-valid-id',
      ).success,
    ).toBe(false);
  });
});