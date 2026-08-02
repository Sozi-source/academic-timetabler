import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  cohortFormSchema,
  cohortIdSchema,
  cohortStatusActionSchema,
} from '@/features/cohorts/validation';

const validCohort = {
  programmeId:
    '550e8400-e29b-41d4-a716-446655440000',
  code: 'DHN-SEP-2026',
  name: 'DHN September 2026',
  intakeDate: '2026-09-01',
  expectedCompletionDate:
    '2029-08-31',
  currentAcademicPeriodNumber: 1,
  plannedSize: 50,
  actualSize: 0,
  status: 'planned',
  notes:
    'September 2026 intake.',
};

describe('cohortFormSchema', () => {
  it('accepts a valid planned cohort', () => {
    const result =
      cohortFormSchema.safeParse(
        validCohort,
      );

    expect(result.success).toBe(true);
  });

  it('normalizes the cohort code', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        code: 'dhn-sep-2026',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'DHN-SEP-2026',
      );
    }
  });

  it('coerces numeric form fields', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        currentAcademicPeriodNumber: '2',
        plannedSize: '50',
        actualSize: '45',
        status: 'active',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.currentAcademicPeriodNumber,
      ).toBe(2);

      expect(result.data.plannedSize).toBe(
        50,
      );

      expect(result.data.actualSize).toBe(
        45,
      );
    }
  });

  it('rejects completion before intake', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        expectedCompletionDate:
          '2026-08-31',
      });

    expect(result.success).toBe(false);
  });

  it('rejects actual size above planned size', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        plannedSize: 40,
        actualSize: 45,
        status: 'active',
      });

    expect(result.success).toBe(false);
  });

  it('rejects a planned cohort with enrolled learners', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        actualSize: 10,
        status: 'planned',
      });

    expect(result.success).toBe(false);
  });

  it('accepts an omitted planned size', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        plannedSize: undefined,
      });

    expect(result.success).toBe(true);
  });

  it('rejects unsupported cohort-code characters', () => {
    const result =
      cohortFormSchema.safeParse({
        ...validCohort,
        code: 'DHN # SEP 2026',
      });

    expect(result.success).toBe(false);
  });
});

describe('cohortIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      cohortIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid cohort identifier', () => {
    expect(
      cohortIdSchema.safeParse(
        'invalid-cohort',
      ).success,
    ).toBe(false);
  });
});

describe('cohortStatusActionSchema', () => {
  it('accepts a valid lifecycle change', () => {
    const result =
      cohortStatusActionSchema.safeParse({
        id:
          '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed',
      });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported status', () => {
    const result =
      cohortStatusActionSchema.safeParse({
        id:
          '550e8400-e29b-41d4-a716-446655440000',
        status: 'deleted',
      });

    expect(result.success).toBe(false);
  });
});