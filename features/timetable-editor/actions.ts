'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { loadParticipantResolver } from './participant-integrity';
import type { EditorActionState } from './types';
import { bulkLockSchema, moveSessionSchema, scheduleAllocationSchema, sessionIdSchema } from './validation';

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

  // If the session was hard-fixed / locked, manage the lock transparently
  // so HOD can reassign rooms or move slots without manual unlock friction.
  const { data: targetSession } = await supabase
    .from('scheduled_sessions')
    .select('is_locked, status')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();

  const wasLocked = Boolean(targetSession?.is_locked || targetSession?.status === 'locked');

  if (wasLocked) {
    await supabase.rpc('toggle_scheduled_session_lock', {
      target_session_id: parsed.data.sessionId,
    });
  }

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

  if (wasLocked) {
    await supabase.rpc('toggle_scheduled_session_lock', {
      target_session_id: parsed.data.sessionId,
    });
  }

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

export async function bulkLockTimetableSessionsAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const parsed = bulkLockSchema.safeParse({
    academicPeriodId: formData.get('academicPeriodId'),
    lock: formData.get('lock'),
  });
  if (!parsed.success) throw new Error('Invalid bulk lock request.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('bulk_lock_department_timetable_sessions', {
    target_academic_period_id: parsed.data.academicPeriodId,
    target_lock_state: parsed.data.lock,
  });
  if (error) throw new Error(error.message);
  refreshEditor();
}

function getRelVal<T extends Record<string, unknown>>(
  rel: unknown,
  key: string,
): string | undefined {
  if (!rel || typeof rel !== 'object') return undefined;
  if (Array.isArray(rel)) {
    const first = rel[0];
    return first && typeof first === 'object' && key in first ? String((first as Record<string, unknown>)[key]) : undefined;
  }
  return key in rel ? String((rel as Record<string, unknown>)[key]) : undefined;
}

async function diagnoseScheduleClash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    allocationId: string;
    workingDayId: string;
    startTimeSlotId: string;
    endTimeSlotId: string;
    trainerId?: string;
    roomId?: string;
    participantCohortIds?: string[];
    fallbackError: string;
  },
): Promise<string> {
  try {
    const { data: allocation } = await supabase
      .from('teaching_allocations')
      .select('academic_period_id, cohort_id, participant_cohort_ids, teaching_offering_id')
      .eq('id', params.allocationId)
      .maybeSingle();

    if (!allocation) return params.fallbackError;

    // Authoritative shared-class membership: a cohort that has dropped the unit must not
    // be reported as clashing, whichever stale array it still appears in.
    const participantResolver = await loadParticipantResolver(
      supabase,
      allocation.academic_period_id,
    );

    const { data: startSlot } = await supabase
      .from('time_slots')
      .select('starts_at, ends_at')
      .eq('id', params.startTimeSlotId)
      .maybeSingle();

    const { data: endSlot } = await supabase
      .from('time_slots')
      .select('starts_at, ends_at')
      .eq('id', params.endTimeSlotId)
      .maybeSingle();

    if (!startSlot || !endSlot) return params.fallbackError;

    const targetStart = startSlot.starts_at;
    const targetEnd = endSlot.ends_at;

    const participantIdArray =
      params.participantCohortIds && params.participantCohortIds.length > 0
        ? participantResolver.sanitize(
            allocation.cohort_id,
            allocation.teaching_offering_id,
            Array.from(new Set([...params.participantCohortIds, allocation.cohort_id])),
          )
        : Array.from(
            participantResolver.resolve(allocation.cohort_id, allocation.teaching_offering_id),
          );

    const { data: overlappingSessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        cohort_id,
        teaching_allocation_id,
        trainer_id,
        room_id,
        participant_cohort_ids,
        cohorts ( code, name ),
        units ( code, name ),
        trainers ( full_name ),
        rooms ( name, code ),
        time_slots:start_time_slot_id ( starts_at ),
        end_time_slots:end_time_slot_id ( ends_at )
      `)
      .eq('academic_period_id', allocation.academic_period_id)
      .eq('working_day_id', params.workingDayId)
      .in('status', ['draft', 'confirmed', 'locked']);

    const validOverlapping = (overlappingSessions || []).filter((s) => {
      const sStart = getRelVal(s.time_slots, 'starts_at');
      const sEnd = getRelVal(s.end_time_slots, 'ends_at') ?? sStart;
      if (!sStart || !sEnd) return false;
      return sStart < targetEnd && targetStart < sEnd;
    });

    // Check cohort clash
    for (const session of validOverlapping) {
      const sessionCohortIds = new Set<string>(
        participantResolver.sanitize(
          session.cohort_id,
          participantResolver.offeringIdForAllocation(session.teaching_allocation_id),
          Array.isArray(session.participant_cohort_ids) ? session.participant_cohort_ids : [],
        ),
      );

      for (const targetCohortId of participantIdArray) {
        if (sessionCohortIds.has(targetCohortId)) {
          const { data: targetCohort } = await supabase
            .from('cohorts')
            .select('code')
            .eq('id', targetCohortId)
            .maybeSingle();

          const clashingCohortCode = targetCohort?.code ?? getRelVal(session.cohorts, 'code') ?? 'Cohort';
          const isSharedPartner = targetCohortId !== allocation.cohort_id;
          const unitCode = getRelVal(session.units, 'code') ?? 'Unit';
          const unitName = getRelVal(session.units, 'name') ?? '';
          const trainerName = getRelVal(session.trainers, 'full_name') ?? 'Unassigned';
          const roomName = getRelVal(session.rooms, 'name');
          const roomPart = roomName ? ` in ${roomName}` : '';

          const ownerCode = getRelVal(session.cohorts, 'code');
          const sharedPart =
            ownerCode && ownerCode !== clashingCohortCode
              ? ` That session is a shared class led by ${ownerCode}.`
              : '';

          if (isSharedPartner) {
            return `Cohort clash: Shared partner cohort "${clashingCohortCode}" (participating in this unit) already has ${unitCode} (${unitName}) with ${trainerName}${roomPart} at this time. All participating cohorts must be free.${sharedPart}`;
          }
          return `Cohort clash: Cohort "${clashingCohortCode}" already has ${unitCode} (${unitName}) with ${trainerName}${roomPart} at this time.${sharedPart}`;
        }
      }
    }

    // Check trainer clash
    if (params.trainerId) {
      const clashingTrainerSession = validOverlapping.find((s) => s.trainer_id === params.trainerId);
      if (clashingTrainerSession) {
        const trainerName = getRelVal(clashingTrainerSession.trainers, 'full_name') ?? 'The selected trainer';
        const unitCode = getRelVal(clashingTrainerSession.units, 'code') ?? 'Unit';
        const cohortCode = getRelVal(clashingTrainerSession.cohorts, 'code') ?? 'another cohort';
        const roomName = getRelVal(clashingTrainerSession.rooms, 'name');
        const roomPart = roomName ? ` in ${roomName}` : '';
        return `Trainer clash: ${trainerName} is already scheduled for ${unitCode} (${cohortCode})${roomPart} at this time.`;
      }
    }

    // Check room clash
    if (params.roomId) {
      const clashingRoomSession = validOverlapping.find((s) => s.room_id === params.roomId);
      if (clashingRoomSession) {
        const roomName = getRelVal(clashingRoomSession.rooms, 'name') ?? 'The selected room';
        const unitCode = getRelVal(clashingRoomSession.units, 'code') ?? 'Unit';
        const cohortCode = getRelVal(clashingRoomSession.cohorts, 'code') ?? 'another cohort';
        return `Room clash: Room ${roomName} is already occupied by ${unitCode} (${cohortCode}) at this time.`;
      }
    }
  } catch (diagError) {
    console.error('Error diagnosing timetable clash:', diagError);
  }

  return params.fallbackError;
}

export async function scheduleAllocationSessionAction(
  _previousState: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  await requireHodAccess();

  const slotId = formData.get('timeSlotId') || formData.get('startTimeSlotId');
  const parsed = scheduleAllocationSchema.safeParse({
    allocationId: formData.get('allocationId'),
    workingDayId: formData.get('workingDayId'),
    startTimeSlotId: slotId,
    endTimeSlotId: formData.get('endTimeSlotId') || slotId,
    roomId: formData.get('roomId'),
    trainerId: formData.get('trainerId'),
    notes: formData.get('notes') || undefined,
    isLocked: formData.get('isLocked') ?? 'true',
    participantCohortIds: formData.get('participantCohortIds') || undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Review the selected day, slot, and room.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('schedule_allocation_session_safely', {
    target_allocation_id: parsed.data.allocationId,
    target_working_day_id: parsed.data.workingDayId,
    target_start_time_slot_id: parsed.data.startTimeSlotId,
    target_end_time_slot_id: parsed.data.endTimeSlotId,
    target_room_id: parsed.data.roomId || null,
    target_notes: parsed.data.notes ?? null,
    target_trainer_id: parsed.data.trainerId || null,
    target_is_locked: parsed.data.isLocked,
    target_participant_cohort_ids: parsed.data.participantCohortIds ?? null,
  });

  if (error) {
    const detailedMessage = await diagnoseScheduleClash(supabase, {
      allocationId: parsed.data.allocationId,
      workingDayId: parsed.data.workingDayId,
      startTimeSlotId: parsed.data.startTimeSlotId,
      endTimeSlotId: parsed.data.endTimeSlotId,
      trainerId: parsed.data.trainerId,
      roomId: parsed.data.roomId,
      participantCohortIds: parsed.data.participantCohortIds,
      fallbackError: error.message,
    });
    return { status: 'error', message: detailedMessage };
  }

  refreshEditor();
  return { status: 'success', message: 'Session placed and locked on the timetable.' };
}

export async function combineMatchingUnitsAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const academicPeriodId = sessionIdSchema.safeParse(formData.get('academicPeriodId'));
  if (!academicPeriodId.success) throw new Error('Invalid Academic Period.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_matching_unit_offerings', {
    p_academic_period_id: academicPeriodId.data,
  });
  if (error) throw new Error(error.message);
  refreshEditor();
}

export async function unscheduleSessionAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const id = sessionIdSchema.safeParse(formData.get('sessionId'));
  if (!id.success) throw new Error('Invalid scheduled session.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('unschedule_session_safely', {
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

