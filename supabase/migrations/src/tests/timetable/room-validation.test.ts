import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  roomFormSchema,
  roomIdSchema,
} from '@/features/rooms/validation';

const validRoom = {
  code: 'DCM-1',
  name: 'Diploma Classroom 1',
  roomType: 'lecture_room',
  building: 'Main Academic Block',
  floorLabel: 'First Floor',
  capacity: 45,
  isAccessible: true,
  isTimetableAvailable: true,
  notes: 'Primary classroom.',
};

describe('roomFormSchema', () => {
  it('accepts a valid room', () => {
    const result =
      roomFormSchema.safeParse(
        validRoom,
      );

    expect(result.success).toBe(true);
  });

  it('normalizes a room code to uppercase', () => {
    const result =
      roomFormSchema.safeParse({
        ...validRoom,
        code: 'dcm-2',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.code).toBe(
        'DCM-2',
      );
    }
  });

  it('coerces capacity from a form string', () => {
    const result =
      roomFormSchema.safeParse({
        ...validRoom,
        capacity: '60',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.capacity).toBe(
        60,
      );
    }
  });

  it('rejects zero capacity', () => {
    const result =
      roomFormSchema.safeParse({
        ...validRoom,
        capacity: 0,
      });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported room-code characters', () => {
    const result =
      roomFormSchema.safeParse({
        ...validRoom,
        code: 'DCM / 1',
      });

    expect(result.success).toBe(false);
  });

  it('accepts optional location fields', () => {
    const result =
      roomFormSchema.safeParse({
        ...validRoom,
        building: undefined,
        floorLabel: undefined,
        notes: undefined,
      });

    expect(result.success).toBe(true);
  });
});

describe('roomIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      roomIdSchema.safeParse(
        '550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid room identifier', () => {
    expect(
      roomIdSchema.safeParse(
        'invalid-room',
      ).success,
    ).toBe(false);
  });
});