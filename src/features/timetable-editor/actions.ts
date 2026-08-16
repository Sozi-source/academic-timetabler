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
}

export async function moveScheduledSessionAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  await requireHodAccess();

  const parsed = moveSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    workingDayId: formData.get('workingDayId'),
    startTimeSlotId: formData.get('startTimeSlotId'),
    endTimeSlotId: formData.get('endTimeSlotId'),
    roomId: formData.get('roomId'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Review the selected day and time.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('move_scheduled_session_safely', {
    target_session_id: parsed.data.sessionId,
    target_working_day_id: parsed.data.workingDayId,
    target_start_time_slot_id: parsed.data.startTimeSlotId,
    target_end_time_slot_id: parsed.data.endTimeSlotId,
    target_room_id: parsed.data.roomId || null,
    target_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  refreshEditor();
  return { status: 'success', message: 'Session moved successfully.' };
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
