import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  roomImportRowSchema,
} from '@/features/imports/rooms/validation';

const validRoom = {
  code: 'lab-01',
  name: 'Nutrition Laboratory',
  roomType: 'laboratory',
  capacity: '40',
  building: 'Academic Block',
  floor: 'Ground Floor',
  timetableAvailable: 'Yes',
  notes: 'Suitable for practical sessions.',
};

describe('roomImportRowSchema', () => {
  it('normalizes a valid Room row', () => {
    const result =
      roomImportRowSchema.safeParse(
        validRoom,
      );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'LAB-01',
      );

      expect(result.data.capacity).toBe(
        40,
      );

      expect(
        result.data.timetableAvailable,
      ).toBe(true);
    }
  });

  it('accepts optional blank fields', () => {
    const result =
      roomImportRowSchema.safeParse({
        ...validRoom,
        building: '',
        floor: '',
        notes: '',
      });

    expect(result.success).toBe(true);
  });

  it('rejects invalid room codes', () => {
    const result =
      roomImportRowSchema.safeParse({
        ...validRoom,
        code: 'LAB # 01',
      });

    expect(result.success).toBe(false);
  });

  it('rejects zero room capacity', () => {
    const result =
      roomImportRowSchema.safeParse({
        ...validRoom,
        capacity: 0,
      });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported room types', () => {
    const result =
      roomImportRowSchema.safeParse({
        ...validRoom,
        roomType: 'auditorium',
      });

    expect(result.success).toBe(false);
  });
});