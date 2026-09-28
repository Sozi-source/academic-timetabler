import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  unitFormSchema,
  unitIdSchema,
} from '@/features/units/validation';

const validUnit = {
  programmeId:
    '550e8400-e29b-41d4-a716-446655440000',
  code: 'NUT-101',
  name: 'Introduction to Human Nutrition',
  shortName: 'Human Nutrition I',
  category: 'core',
  academicPeriodNumber: 1,
  theoryHours: 30,
  practicalHours: 15,
  weeklySessions: 3,
  preferredRoomType: 'lecture_room',
  notes:
    'Foundational first-period unit.',
};

describe('unitFormSchema', () => {
  it('accepts a valid unit', () => {
    const result =
      unitFormSchema.safeParse(
        validUnit,
      );

    expect(result.success).toBe(true);
  });

  it('normalizes the unit code', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        code: 'nut-102',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'NUT-102',
      );
    }
  });

  it('coerces numeric form fields', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        academicPeriodNumber: '2',
        theoryHours: '25',
        practicalHours: '10',
        weeklySessions: '2',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.academicPeriodNumber,
      ).toBe(2);

      expect(
        result.data.theoryHours,
      ).toBe(25);

      expect(
        result.data.practicalHours,
      ).toBe(10);

      expect(
        result.data.weeklySessions,
      ).toBe(2);
    }
  });

  it('rejects a unit with no contact hours', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        theoryHours: 0,
        practicalHours: 0,
      });

    expect(result.success).toBe(false);
  });

  it('requires practical hours for a practical unit', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        category: 'practical',
        theoryHours: 30,
        practicalHours: 0,
      });

    expect(result.success).toBe(false);
  });

  it('accepts an omitted preferred room type', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        preferredRoomType: undefined,
      });

    expect(result.success).toBe(true);
  });

  it('rejects unsupported unit-code characters', () => {
    const result =
      unitFormSchema.safeParse({
        ...validUnit,
        code: 'NUT # 101',
      });

    expect(result.success).toBe(false);
  });
});

describe('unitIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      unitIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid unit identifier', () => {
    expect(
      unitIdSchema.safeParse(
        'invalid-unit',
      ).success,
    ).toBe(false);
  });
});