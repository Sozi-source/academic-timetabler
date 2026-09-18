import { describe, expect, it } from 'vitest';
import { bulkLockSchema, moveSessionSchema, scheduleAllocationSchema } from '@/features/timetable-editor/validation';

const id = '550e8400-e29b-41d4-a716-446655440000';
describe('moveSessionSchema', () => {
  it('accepts a complete session move', () => {
    expect(moveSessionSchema.safeParse({
      sessionId: id,
      workingDayId: id,
      startTimeSlotId: id,
      endTimeSlotId: id,
      roomId: id,
      notes: 'Moved by HOD',
    }).success).toBe(true);
  });
  it('rejects invalid identifiers', () => {
    expect(moveSessionSchema.safeParse({
      sessionId: 'bad', workingDayId: id, startTimeSlotId: id, endTimeSlotId: id, roomId: id,
    }).success).toBe(false);
  });
});

describe('bulkLockSchema', () => {
  it('accepts valid bulk lock requests and transforms boolean string', () => {
    const parsed = bulkLockSchema.safeParse({
      academicPeriodId: id,
      lock: 'true',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lock).toBe(true);
    }
  });

  it('accepts valid bulk unlock requests', () => {
    const parsed = bulkLockSchema.safeParse({
      academicPeriodId: id,
      lock: 'false',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lock).toBe(false);
    }
  });

  it('rejects invalid boolean strings or ids', () => {
    expect(bulkLockSchema.safeParse({
      academicPeriodId: 'not-a-uuid',
      lock: 'true',
    }).success).toBe(false);

    expect(bulkLockSchema.safeParse({
      academicPeriodId: id,
      lock: 'invalid',
    }).success).toBe(false);
  });
});

describe('scheduleAllocationSchema', () => {
  it('accepts valid allocation placement and defaults isLocked to true', () => {
    const parsed = scheduleAllocationSchema.safeParse({
      allocationId: id,
      workingDayId: id,
      startTimeSlotId: id,
      endTimeSlotId: id,
      roomId: id,
      trainerId: id,
      notes: 'Physical master timetable placement',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isLocked).toBe(true);
    }
  });

  it('accepts placement with empty roomId', () => {
    const parsed = scheduleAllocationSchema.safeParse({
      allocationId: id,
      workingDayId: id,
      startTimeSlotId: id,
      endTimeSlotId: id,
      roomId: '',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid allocationId or workingDayId', () => {
    expect(scheduleAllocationSchema.safeParse({
      allocationId: 'bad',
      workingDayId: id,
      startTimeSlotId: id,
      endTimeSlotId: id,
      roomId: id,
    }).success).toBe(false);
  });
});

