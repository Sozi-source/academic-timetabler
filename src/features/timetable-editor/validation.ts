import { z } from 'zod';

export const moveSessionSchema = z.object({
  sessionId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  startTimeSlotId: z.string().uuid(),
  endTimeSlotId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]),
  trainerId: z.union([z.string().uuid(), z.literal('')]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const sessionIdSchema = z.string().uuid();
