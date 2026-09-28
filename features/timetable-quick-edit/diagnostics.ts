import 'server-only';

import { createClient } from '@/lib/supabase/server';

interface DiagnoseParams {
  sessionId: string;
  /**
   * Omit these for a room-only change: the day/time aren't moving, so the
   * diagnostic reads them off the session itself (one extra column on the
   * same context query — no added round trip).
   */
  workingDayId?: string;
  startTimeSlotId?: string;
  endTimeSlotId?: string;
  roomId?: string | null;
  trainerId?: string | null;
  /** The RPC's own error message — already tells us which kind of clash to look for. */
  fallbackMessage: string;
}

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Compare to timetable-editor/actions.ts `diagnoseScheduleClash`, which
 * re-queries EVERY session for the whole day across every cohort, trainer
 * and room to find the one that clashed. This version already knows which
 * single resource is implicated (the trainer or room the RPC rejected, or
 * the session's own cohort), so it scopes the candidate query to that one
 * resource's sessions that day — typically a handful of rows, not the
 * whole department's timetable — and filters for the actual time overlap
 * in memory. Two queries, always, no matter which clash type it is.
 */
export async function diagnoseQuickEditClash(params: DiagnoseParams): Promise<{
  message: string;
  suggestion: string | null;
}> {
  const fallback = {
    message: params.fallbackMessage,
    suggestion: genericSuggestion(params.fallbackMessage),
  };

  try {
    const supabase = await createClient();
    const normalized = params.fallbackMessage.toLowerCase();

    // Query 1: session context — cohort (for a cohort clash), and the
    // session's OWN current day/slots/trainer/room, used as fallbacks for
    // whichever of those a room-only or trainer-only change didn't pass in
    // (they aren't changing, so the caller doesn't have new values for them).
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('academic_period_id, cohort_id, trainer_id, room_id, working_day_id, start_time_slot_id, end_time_slot_id')
      .eq('id', params.sessionId)
      .single();

    if (!session) return fallback;

    const effectiveWorkingDayId = params.workingDayId ?? session.working_day_id;
    const effectiveStartSlotId = params.startTimeSlotId ?? session.start_time_slot_id;
    const effectiveEndSlotId = params.endTimeSlotId ?? session.end_time_slot_id;

    const { data: slots } = await supabase
      .from('time_slots')
      .select('id, starts_at, ends_at')
      .in('id', [effectiveStartSlotId, effectiveEndSlotId]);

    const effectiveTrainerId = params.trainerId ?? session.trainer_id;
    const effectiveRoomId = params.roomId ?? session.room_id;
    const isTrainerClash = normalized.startsWith('trainer') && Boolean(effectiveTrainerId);
    const isRoomClash = normalized.startsWith('room') && Boolean(effectiveRoomId);
    // Anything else (including the generic "Cohort ... already scheduled" message)
    // falls back to scoping by the session's own cohort below.

    const startSlot = (slots ?? []).find((slot) => slot.id === effectiveStartSlotId);
    const endSlot = (slots ?? []).find((slot) => slot.id === effectiveEndSlotId);
    if (!startSlot || !endSlot) return fallback;

    const targetStart = startSlot.starts_at;
    const targetEnd = endSlot.ends_at;

    // Query 2: candidates scoped to ONE resource (the specific trainer, the
    // specific room, or — for a cohort clash — this session's own cohort)
    // on this one day. Not the whole day's timetable.
    let candidateQuery = supabase
      .from('scheduled_sessions')
      .select(`
        id,
        start_time_slot_id,
        end_time_slot_id,
        units ( code, name ),
        cohorts ( code )
      `)
      .neq('id', params.sessionId)
      .eq('academic_period_id', session.academic_period_id)
      .eq('working_day_id', effectiveWorkingDayId)
      .not('status', 'in', '(cancelled,archived)');

    if (isTrainerClash) {
      candidateQuery = candidateQuery.eq('trainer_id', effectiveTrainerId as string);
    } else if (isRoomClash) {
      candidateQuery = candidateQuery.eq('room_id', effectiveRoomId as string);
    } else {
      candidateQuery = candidateQuery.eq('cohort_id', session.cohort_id);
    }

    const { data: candidates } = await candidateQuery;
    if (!candidates || candidates.length === 0) return fallback;

    const candidateSlotIds = Array.from(
      new Set(candidates.flatMap((c) => [c.start_time_slot_id, c.end_time_slot_id])),
    );
    const { data: candidateSlots } = await supabase
      .from('time_slots')
      .select('id, starts_at, ends_at')
      .in('id', candidateSlotIds);

    const slotById = new Map((candidateSlots ?? []).map((s) => [s.id, s]));

    const clash = candidates.find((candidate) => {
      const cStart = slotById.get(candidate.start_time_slot_id)?.starts_at;
      const cEnd = slotById.get(candidate.end_time_slot_id)?.ends_at;
      if (!cStart || !cEnd) return false;
      return cStart < targetEnd && targetStart < cEnd;
    });

    if (!clash) return fallback;

    const unit = first(clash.units as Relation<{ code: string; name: string }>);
    const cohort = first(clash.cohorts as Relation<{ code: string }>);
    const unitLabel = unit ? `${unit.code} (${unit.name})` : 'another class';
    const cohortLabel = cohort?.code ?? 'another cohort';

    const message = isTrainerClash
      ? `Trainer clash: already teaching ${unitLabel} for ${cohortLabel} at this time.`
      : isRoomClash
        ? `Room clash: already booked for ${unitLabel} (${cohortLabel}) at this time.`
        : `Cohort clash: already has ${unitLabel} at this time.`;

    return { message, suggestion: genericSuggestion(params.fallbackMessage) };
  } catch {
    // Diagnostics are best-effort. The RPC already refused the write —
    // never let a failed diagnostic hide that.
    return fallback;
  }
}

function genericSuggestion(message: string): string | null {
  const normalized = message.toLowerCase();
  if (normalized.startsWith('trainer')) return 'Try a later slot or a different trainer.';
  if (normalized.startsWith('room')) return 'Try a different room, or the same room at another time.';
  if (normalized.startsWith('cohort')) return 'Pick another slot — this cohort is already booked then.';
  return null;
}
