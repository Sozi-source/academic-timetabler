import { z } from 'zod';

export const quickEditSessionIdSchema = z.string().uuid();

/** Day/time (and optionally room in the same move) — calls move_scheduled_session_safely. */
export const quickMoveScheduleSchema = z.object({
  sessionId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  startTimeSlotId: z.string().uuid(),
  endTimeSlotId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]).optional(),
});

/** Room only, same day/time — calls the lighter assign_scheduled_session_room_safely. */
export const quickReassignRoomSchema = z.object({
  sessionId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]),
});

/**
 * Trainer only, same day/slot/room — still goes through move_scheduled_session_safely
 * (it's the only RPC that knows how to propagate a genuine trainer change), but every
 * schedule field is passed through unchanged so only the trainer moves.
 */
export const quickReassignTrainerSchema = z.object({
  sessionId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  startTimeSlotId: z.string().uuid(),
  endTimeSlotId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]).optional(),
  trainerId: z.string().uuid(),
});
