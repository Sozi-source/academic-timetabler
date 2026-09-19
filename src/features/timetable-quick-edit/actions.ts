'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { diagnoseQuickEditClash } from './diagnostics';
import type { QuickEditActionState } from './types';
import {
  quickEditSessionIdSchema,
  quickMoveScheduleSchema,
  quickReassignRoomSchema,
  quickReassignTrainerSchema,
} from './validation';

/**
 * Deliberately NOT the full editor's refreshEditor() (which revalidates
 * /timetable/editor, /timetable/generator, /timetable/conflicts,
 * /timetable/published, /timetable/reports on every write — see
 * changes.md, "The actual bottleneck"). QuickEditPanel is mounted inside
 * the existing editor page (see Task 5), so it only needs THAT one route
 * fresh — still one route instead of five, just not a separate page as
 * originally guessed in Task 2.
 */
function refreshQuickEdit() {
  revalidatePath('/timetable/editor');
}

function errorState(message: string): QuickEditActionState {
  // Bare fallback for validation errors that never reached an RPC —
  // no clash to diagnose, so no suggestion.
  return { status: 'error', message, suggestion: null };
}

/** Move a session's day/time (and optionally room in the same step). */
export async function quickMoveScheduleAction(
  _previousState: QuickEditActionState,
  formData: FormData,
): Promise<QuickEditActionState> {
  await requireHodAccess();

  const parsed = quickMoveScheduleSchema.safeParse({
    sessionId: formData.get('sessionId'),
    workingDayId: formData.get('workingDayId'),
    startTimeSlotId: formData.get('startTimeSlotId'),
    endTimeSlotId: formData.get('endTimeSlotId') || formData.get('startTimeSlotId'),
    roomId: formData.get('roomId') || undefined,
  });

  if (!parsed.success) {
    return errorState('Review the selected day and time.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('move_scheduled_session_safely', {
    target_session_id: parsed.data.sessionId,
    target_working_day_id: parsed.data.workingDayId,
    target_start_time_slot_id: parsed.data.startTimeSlotId,
    target_end_time_slot_id: parsed.data.endTimeSlotId,
    target_room_id: parsed.data.roomId || null,
    // Trainer omitted on purpose: this action only moves day/time/room.
    // Task 1's fix means omitting it here no longer wipes the trainer.
  });

  if (error) {
    const diagnosis = await diagnoseQuickEditClash({
      sessionId: parsed.data.sessionId,
      workingDayId: parsed.data.workingDayId,
      startTimeSlotId: parsed.data.startTimeSlotId,
      endTimeSlotId: parsed.data.endTimeSlotId,
      roomId: parsed.data.roomId || null,
      fallbackMessage: error.message,
    });
    return { status: 'error', message: diagnosis.message, suggestion: diagnosis.suggestion };
  }

  refreshQuickEdit();
  return { status: 'success', message: 'Session moved.', suggestion: null };
}

/** Swap only the room, same day/time — uses the lighter single-purpose RPC. */
export async function quickReassignRoomAction(
  _previousState: QuickEditActionState,
  formData: FormData,
): Promise<QuickEditActionState> {
  await requireHodAccess();

  const parsed = quickReassignRoomSchema.safeParse({
    sessionId: formData.get('sessionId'),
    roomId: formData.get('roomId'),
  });

  if (!parsed.success) {
    return errorState('Select a room.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_scheduled_session_room_safely', {
    target_session_id: parsed.data.sessionId,
    target_room_id: parsed.data.roomId || null,
  });

  if (error) {
    // Day/time aren't passed here — this is a room-only change, so
    // diagnoseQuickEditClash reads the session's own current day/slots.
    const diagnosis = await diagnoseQuickEditClash({
      sessionId: parsed.data.sessionId,
      roomId: parsed.data.roomId || null,
      fallbackMessage: error.message,
    });
    return { status: 'error', message: diagnosis.message, suggestion: diagnosis.suggestion };
  }

  refreshQuickEdit();
  return { status: 'success', message: 'Room updated.', suggestion: null };
}

/** Swap only the trainer, same day/slot/room. Propagates to sibling sessions of this allocation — that is the intended behavior of a trainer change, not a bug (see changes.md Task 1). */
export async function quickReassignTrainerAction(
  _previousState: QuickEditActionState,
  formData: FormData,
): Promise<QuickEditActionState> {
  await requireHodAccess();

  const parsed = quickReassignTrainerSchema.safeParse({
    sessionId: formData.get('sessionId'),
    workingDayId: formData.get('workingDayId'),
    startTimeSlotId: formData.get('startTimeSlotId'),
    endTimeSlotId: formData.get('endTimeSlotId') || formData.get('startTimeSlotId'),
    roomId: formData.get('roomId') || undefined,
    trainerId: formData.get('trainerId'),
  });

  if (!parsed.success) {
    return errorState('Select a trainer.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('move_scheduled_session_safely', {
    target_session_id: parsed.data.sessionId,
    target_working_day_id: parsed.data.workingDayId,
    target_start_time_slot_id: parsed.data.startTimeSlotId,
    target_end_time_slot_id: parsed.data.endTimeSlotId,
    target_room_id: parsed.data.roomId || null,
    target_trainer_id: parsed.data.trainerId,
  });

  if (error) {
    const diagnosis = await diagnoseQuickEditClash({
      sessionId: parsed.data.sessionId,
      workingDayId: parsed.data.workingDayId,
      startTimeSlotId: parsed.data.startTimeSlotId,
      endTimeSlotId: parsed.data.endTimeSlotId,
      roomId: parsed.data.roomId || null,
      // The NEW trainer being proposed — that's who the RPC checked for a clash.
      trainerId: parsed.data.trainerId,
      fallbackMessage: error.message,
    });
    return { status: 'error', message: diagnosis.message, suggestion: diagnosis.suggestion };
  }

  refreshQuickEdit();
  return { status: 'success', message: 'Trainer updated.', suggestion: null };
}

/** Surfaced directly on the Quick Edit success toast — see changes.md §5. */
export async function quickUndoLastChangeAction(formData: FormData): Promise<QuickEditActionState> {
  await requireHodAccess();

  const academicPeriodId = quickEditSessionIdSchema.safeParse(formData.get('academicPeriodId'));
  if (!academicPeriodId.success) {
    return errorState('Invalid Academic Period.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('undo_last_timetable_session_change', {
    target_academic_period_id: academicPeriodId.data,
  });

  if (error) {
    return errorState(error.message);
  }

  refreshQuickEdit();
  return { status: 'success', message: 'Last change undone.', suggestion: null };
}
