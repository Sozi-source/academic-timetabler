import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  unitImportRowSchema,
} from '@/features/imports/units/validation';

const validUnit = {
  programmeCode: 'dhn',
  code: 'nut-101',
  name: 'Introduction to Human Nutrition',
  shortName: 'Human Nutrition I',
  category: 'core',
  academicPeriodNumber: '1',
  theoryHours: '30',
  practicalHours: '15',
  weeklySessions: '3',
  preferredRoomType: 'lecture_room',
  timetableAvailable: 'Yes',
  notes: 'Foundational unit.',
};

describe('unitImportRowSchema', () => {
  it('normalizes a valid Unit row', () => {
    const result =
      unitImportRowSchema.safeParse(
        validUnit,
      );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.programmeCode,
      ).toBe('DHN');

      expect(result.data.code).toBe(
        'NUT-101',
      );

      expect(
        result.data.academicPeriodNumber,
      ).toBe(1);

      expect(
        result.data.timetableAvailable,
      ).toBe(true);
    }
  });

  it('accepts optional blank values', () => {
    const result =
      unitImportRowSchema.safeParse({
        ...validUnit,
        shortName: '',
        preferredRoomType: '',
        notes: '',
      });

    expect(result.success).toBe(true);
  });

  it('rejects a unit with no contact hours', () => {
    const result =
      unitImportRowSchema.safeParse({
        ...validUnit,
        theoryHours: 0,
        practicalHours: 0,
      });

    expect(result.success).toBe(false);
  });

  it('requires practical hours for a practical unit', () => {
    const result =
      unitImportRowSchema.safeParse({
        ...validUnit,
        category: 'practical',
        theoryHours: 30,
        practicalHours: 0,
      });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported room types', () => {
    const result =
      unitImportRowSchema.safeParse({
        ...validUnit,
        preferredRoomType:
          'auditorium',
      });

    expect(result.success).toBe(false);
  });

  it('rejects invalid unit-code characters', () => {
    const result =
      unitImportRowSchema.safeParse({
        ...validUnit,
        code: 'NUT # 101',
      });

    expect(result.success).toBe(false);
  });
});