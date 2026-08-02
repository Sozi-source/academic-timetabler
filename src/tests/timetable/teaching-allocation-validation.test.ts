import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  teachingAllocationFormSchema,
  teachingAllocationIdSchema,
  teachingAllocationStatusActionSchema,
} from '@/features/teaching-allocations/validation';

const validAllocation = {
  academicPeriodId:
    '550e8400-e29b-41d4-a716-446655440000',
  cohortId:
    '550e8400-e29b-41d4-a716-446655440001',
  unitId:
    '550e8400-e29b-41d4-a716-446655440002',
  trainerId:
    '550e8400-e29b-41d4-a716-446655440003',
  preferredRoomId:
    '550e8400-e29b-41d4-a716-446655440004',
  deliveryMode: 'theory',
  weeklySessions: 3,
  sessionDurationMinutes: 120,
  status: 'draft',
  notes:
    'Three weekly theory sessions.',
};

describe(
  'teachingAllocationFormSchema',
  () => {
    it('accepts a valid allocation', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          validAllocation,
        );

      expect(result.success).toBe(true);
    });

    it('coerces numeric form values', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            weeklySessions: '4',
            sessionDurationMinutes:
              '90',
          },
        );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(
          result.data.weeklySessions,
        ).toBe(4);

        expect(
          result.data
            .sessionDurationMinutes,
        ).toBe(90);
      }
    });

    it('accepts no preferred room', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            preferredRoomId: undefined,
          },
        );

      expect(result.success).toBe(true);
    });

    it('rejects session durations outside 15-minute increments', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            sessionDurationMinutes: 100,
          },
        );

      expect(result.success).toBe(false);
    });

    it('rejects a clinical session below 60 minutes', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            deliveryMode: 'clinical',
            sessionDurationMinutes: 45,
          },
        );

      expect(result.success).toBe(false);
    });

    it('rejects zero weekly sessions', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            weeklySessions: 0,
          },
        );

      expect(result.success).toBe(false);
    });

    it('rejects an invalid trainer identifier', () => {
      const result =
        teachingAllocationFormSchema.safeParse(
          {
            ...validAllocation,
            trainerId: 'invalid-trainer',
          },
        );

      expect(result.success).toBe(false);
    });
  },
);

describe(
  'teachingAllocationIdSchema',
  () => {
    it('accepts a valid UUID', () => {
      expect(
        teachingAllocationIdSchema.safeParse(
          '550e8400-e29b-41d4-a716-446655440000',
        ).success,
      ).toBe(true);
    });

    it('rejects an invalid identifier', () => {
      expect(
        teachingAllocationIdSchema.safeParse(
          'invalid-allocation',
        ).success,
      ).toBe(false);
    });
  },
);

describe(
  'teachingAllocationStatusActionSchema',
  () => {
    it('accepts a valid lifecycle change', () => {
      const result =
        teachingAllocationStatusActionSchema.safeParse(
          {
            id:
              '550e8400-e29b-41d4-a716-446655440000',
            status: 'active',
          },
        );

      expect(result.success).toBe(true);
    });

    it('rejects an unsupported status', () => {
      const result =
        teachingAllocationStatusActionSchema.safeParse(
          {
            id:
              '550e8400-e29b-41d4-a716-446655440000',
            status: 'deleted',
          },
        );

      expect(result.success).toBe(false);
    });
  },
);