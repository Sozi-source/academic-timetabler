import { describe, expect, it } from 'vitest';
import { moveSessionSchema } from '@/features/timetable-editor/validation';

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
