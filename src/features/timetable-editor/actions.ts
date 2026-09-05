'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { EditorActionState } from './types';
import { moveSessionSchema, sessionIdSchema } from './validation';

function refreshEditor() {
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/conflicts');
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/reports');
}

export async function moveScheduledSessionAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  await requireHodAccess();

  const slotId = formData.get('timeSlotId') || formData.get('startTimeSlotId');
  const parsed = moveSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    workingDayId: formData.get('workingDayId'),
    startTimeSlotId: slotId,
    endTimeSlotId: formData.get('endTimeSlotId') || slotId,
    roomId: formData.get('roomId'),
    trainerId: formData.get('trainerId'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Review the selected day and time.' };
  }

  const supabase = await createClient();
  const originalNotes = formData.get('originalNotes');
  const roomOnlyChange =
    formData.get('originalWorkingDayId') === parsed.data.workingDayId &&
    formData.get('originalStartTimeSlotId') === parsed.data.startTimeSlotId &&
    formData.get('originalEndTimeSlotId') === parsed.data.endTimeSlotId &&
    (formData.get('originalTrainerId') || null) === (parsed.data.trainerId || null) &&
    (typeof originalNotes === 'string' ? originalNotes : '') === (parsed.data.notes ?? '');

  const { error } = roomOnlyChange
    ? await supabase.rpc('assign_scheduled_session_room_safely', {
        target_session_id: parsed.data.sessionId,
        target_room_id: parsed.data.roomId || null,
      })
    : await supabase.rpc('move_scheduled_session_safely', {
        target_session_id: parsed.data.sessionId,
        target_working_day_id: parsed.data.workingDayId,
        target_start_time_slot_id: parsed.data.startTimeSlotId,
        target_end_time_slot_id: parsed.data.endTimeSlotId,
        target_room_id: parsed.data.roomId || null,
        target_notes: parsed.data.notes ?? null,
        target_trainer_id: parsed.data.trainerId || null,
      });

  if (error) {
    return { status: 'error', message: error.message };
  }

  refreshEditor();
  return { status: 'success', message: 'Session updated successfully.' };
}

export async function toggleScheduledSessionLockAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const id = sessionIdSchema.safeParse(formData.get('sessionId'));
  if (!id.success) throw new Error('Invalid scheduled session.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('toggle_scheduled_session_lock', {
    target_session_id: id.data,
  });
  if (error) throw new Error(error.message);
  refreshEditor();
}

export async function undoLastTimetableEditAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const academicPeriodId = sessionIdSchema.safeParse(formData.get('academicPeriodId'));
  if (!academicPeriodId.success) throw new Error('Invalid Academic Period.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('undo_last_timetable_session_change', {
    target_academic_period_id: academicPeriodId.data,
  });
  if (error) throw new Error(error.message);
  refreshEditor();
}
