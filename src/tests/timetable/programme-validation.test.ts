import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  programmeFormSchema,
  programmeIdSchema,
} from '@/features/programmes/validation';

const validProgramme = {
  code: 'DHN',
  name:
    'Diploma in Human Nutrition and Dietetics',
  shortName: 'DHN',
  awardLevel: 'diploma',
  awardingBody: 'TVET CDACC',
  durationValue: 3,
  durationUnit: 'years',
  totalAcademicPeriods: 9,
  maximumCohortSize: 50,
  notes:
    'Institutional diploma programme.',
};

describe('programmeFormSchema', () => {
  it('accepts a valid programme', () => {
    const result =
      programmeFormSchema.safeParse(
        validProgramme,
      );

    expect(result.success).toBe(true);
  });

  it('normalizes the programme code', () => {
    const result =
      programmeFormSchema.safeParse({
        ...validProgramme,
        code: 'dhn',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'DHN',
      );
    }
  });

  it('coerces numeric form values', () => {
    const result =
      programmeFormSchema.safeParse({
        ...validProgramme,
        durationValue: '3',
        totalAcademicPeriods: '9',
        maximumCohortSize: '50',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.durationValue,
      ).toBe(3);

      expect(
        result.data.totalAcademicPeriods,
      ).toBe(9);

      expect(
        result.data.maximumCohortSize,
      ).toBe(50);
    }
  });

  it('accepts an omitted maximum cohort size', () => {
    const result =
      programmeFormSchema.safeParse({
        ...validProgramme,
        maximumCohortSize: undefined,
      });

    expect(result.success).toBe(true);
  });

  it('rejects zero Academic Periods', () => {
    const result =
      programmeFormSchema.safeParse({
        ...validProgramme,
        totalAcademicPeriods: 0,
      });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported code characters', () => {
    const result =
      programmeFormSchema.safeParse({
        ...validProgramme,
        code: 'DHN # 1',
      });

    expect(result.success).toBe(false);
  });
});

describe('programmeIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      programmeIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid identifier', () => {
    expect(
      programmeIdSchema.safeParse(
        'invalid-programme-id',
      ).success,
    ).toBe(false);
  });
});