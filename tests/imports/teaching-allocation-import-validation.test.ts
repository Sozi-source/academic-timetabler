import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  teachingAllocationImportRowSchema,
} from '@/features/imports/teaching-allocations/validation';

const validAllocation = {
  academicPeriodCode:
    '2026-sem-1',
  cohortCode:
    'dhn-sep-2026',
  unitCode:
    'nut-101',
  trainerStaffNumber:
    'tr-001',
  preferredRoomCode:
    'lab-01',
  deliveryMode:
    'theory',
  weeklySessions:
    '3',
  sessionDurationMinutes:
    '120',
  status:
    'draft',
  timetableEnabled:
    'Yes',
  notes:
    'Morning allocation.',
};

describe(
  'teachingAllocationImportRowSchema',
  () => {
    it('normalizes a valid allocation row', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          validAllocation,
        );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(
          result.data
            .academicPeriodCode,
        ).toBe('2026-SEM-1');

        expect(
          result.data.cohortCode,
        ).toBe('DHN-SEP-2026');

        expect(
          result.data.weeklySessions,
        ).toBe(3);

        expect(
          result.data.timetableEnabled,
        ).toBe(true);
      }
    });

    it('accepts no preferred room', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          {
            ...validAllocation,
            preferredRoomCode: '',
          },
        );

      expect(result.success).toBe(true);
    });

    it('rejects non-15-minute durations', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          {
            ...validAllocation,
            sessionDurationMinutes:
              100,
          },
        );

      expect(result.success).toBe(false);
    });

    it('requires practical sessions to be at least 60 minutes', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          {
            ...validAllocation,
            deliveryMode:
              'practical',
            sessionDurationMinutes:
              45,
          },
        );

      expect(result.success).toBe(false);
    });

    it('rejects timetable-enabled archived allocations', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          {
            ...validAllocation,
            status: 'archived',
            timetableEnabled:
              'Yes',
          },
        );

      expect(result.success).toBe(false);
    });

    it('accepts disabled suspended allocations', () => {
      const result =
        teachingAllocationImportRowSchema.safeParse(
          {
            ...validAllocation,
            status: 'suspended',
            timetableEnabled:
              'No',
          },
        );

      expect(result.success).toBe(true);
    });
  },
);