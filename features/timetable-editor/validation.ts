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

export const bulkLockSchema = z.object({
  academicPeriodId: z.string().uuid(),
  lock: z.enum(['true', 'false']).transform((val) => val === 'true'),
});

export const scheduleAllocationSchema = z.object({
  allocationId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  startTimeSlotId: z.string().uuid(),
  endTimeSlotId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]),
  trainerId: z.union([z.string().uuid(), z.literal('')]).optional(),
  notes: z.string().trim().max(1000).optional(),
  isLocked: z.enum(['true', 'false']).optional().default('true').transform((val) => val !== 'false'),
  participantCohortIds: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed.filter((id) => typeof id === 'string' && id.length > 0) as string[]) : undefined;
    } catch {
      return undefined;
    }
  }),
});
