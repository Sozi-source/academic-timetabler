import { z } from 'zod';

export const moveSessionSchema = z.object({
  sessionId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  startTimeSlotId: z.string().uuid(),
  endTimeSlotId: z.string().uuid(),
  roomId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
});

export const sessionIdSchema = z.string().uuid();
