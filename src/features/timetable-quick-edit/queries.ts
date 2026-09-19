import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { QuickEditField } from './types';
import type {
  QuickEditOptions,
  QuickEditRoomOption,
  QuickEditSessionIdentity,
  QuickEditTrainerOption,
} from './query-types';

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * One row, by primary key. This is the entire "load the session" cost of
 * Quick Edit — compare to the full editor's period-wide session query plus
 * eight other lookups (see changes.md "The actual bottleneck").
 */
async function getQuickEditSessionIdentity(
  sessionId: string,
): Promise<QuickEditSessionIdentity> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      academic_period_id,
      working_day_id,
      start_time_slot_id,
      end_time_slot_id,
      room_id,
      trainer_id,
      is_locked,
      status,
      cohorts ( code ),
      units ( code, name ),
      trainers ( full_name ),
      rooms ( name )
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? 'Session not found.');
  }

  // Two lookups, in parallel, using the ids we just got — the slot pair is
  // fetched in a single `.in()` call rather than two separate round trips.
  const [dayResult, slotResult] = await Promise.all([
    supabase
      .from('working_days')
      .select('day_of_week')
      .eq('id', session.working_day_id)
      .single(),
    supabase
      .from('time_slots')
      .select('id, name, starts_at, ends_at')
      .in('id', [session.start_time_slot_id, session.end_time_slot_id]),
  ]);

  const startSlot = (slotResult.data ?? []).find((slot) => slot.id === session.start_time_slot_id);
  const endSlot = (slotResult.data ?? []).find((slot) => slot.id === session.end_time_slot_id);

  const cohort = first(session.cohorts as Relation<{ code: string }>);
  const unit = first(session.units as Relation<{ code: string; name: string }>);
  const trainer = first(session.trainers as Relation<{ full_name: string }>);
  const room = first(session.rooms as Relation<{ name: string }>);

  return {
    id: session.id,
    academicPeriodId: session.academic_period_id,
    workingDayId: session.working_day_id,
    startTimeSlotId: session.start_time_slot_id,
    endTimeSlotId: session.end_time_slot_id,
    roomId: session.room_id,
    trainerId: session.trainer_id,
    isLocked: session.is_locked,
    status: session.status,
    cohortCode: cohort?.code ?? 'Unknown cohort',
    unitCode: unit?.code ?? '—',
    unitName: unit?.name ?? 'Unknown unit',
    trainerName: trainer?.full_name ?? 'Unassigned trainer',
    roomName: room?.name ?? 'No room assigned',
    dayLabel: dayResult.data
      ? dayResult.data.day_of_week.charAt(0).toUpperCase() + dayResult.data.day_of_week.slice(1)
      : 'Unknown day',
    timeLabel: startSlot && endSlot
      ? `${startSlot.starts_at.slice(0, 5)}–${endSlot.ends_at.slice(0, 5)}`
      : 'Unknown time',
  };
}

async function getScheduleOptions(academicPeriodId: string): Promise<QuickEditOptions> {
  const supabase = await createClient();

  const [dayResult, slotResult] = await Promise.all([
    supabase
      .from('working_days')
      .select('id, day_of_week, sequence_number')
      .eq('academic_period_id', academicPeriodId)
      .eq('is_enabled', true)
      .order('sequence_number'),
    supabase
      .from('time_slots')
      .select('id, name, starts_at, ends_at, sequence_number')
      .eq('academic_period_id', academicPeriodId)
      .eq('is_enabled', true)
      .eq('slot_type', 'teaching')
      .order('sequence_number'),
  ]);

  if (dayResult.error || slotResult.error) {
    throw new Error(
      dayResult.error?.message ?? slotResult.error?.message ?? 'Unable to load schedule options.',
    );
  }

  return {
    field: 'schedule',
    workingDays: (dayResult.data ?? []).map((day) => ({
      id: day.id,
      label: day.day_of_week.charAt(0).toUpperCase() + day.day_of_week.slice(1),
    })),
    timeSlots: (slotResult.data ?? []).map((slot) => ({
      id: slot.id,
      label: `${slot.name} · ${slot.starts_at.slice(0, 5)}–${slot.ends_at.slice(0, 5)}`,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
  };
}

async function getRoomOptions(): Promise<QuickEditOptions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, name, capacity')
    .eq('is_active', true)
    .eq('is_timetable_available', true)
    .order('code');

  if (error) {
    throw new Error(error.message);
  }

  const rooms: QuickEditRoomOption[] = (data ?? []).map((room) => ({
    id: room.id,
    label: room.code,
    capacity: room.capacity,
  }));

  return { field: 'room', rooms };
}

async function getTrainerOptions(): Promise<QuickEditOptions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trainers')
    .select('id, full_name')
    .eq('is_active', true)
    .eq('is_timetable_available', true)
    .order('full_name');

  if (error) {
    throw new Error(error.message);
  }

  const trainers: QuickEditTrainerOption[] = (data ?? []).map((trainer) => ({
    id: trainer.id,
    label: trainer.full_name,
    fullName: trainer.full_name,
  }));

  return { field: 'trainer', trainers };
}

/**
 * The one entry point Quick Edit's UI calls. Two requests total for
 * 'room'/'trainer' (identity + its own option list, fired in parallel since
 * neither list needs the session's academic period). 'schedule' needs the
 * session's academic_period_id first, so it's identity, then the day/slot
 * lookup — still nowhere near the full editor's nine.
 */
export async function getQuickEditData(
  sessionId: string,
  field: QuickEditField,
): Promise<{ session: QuickEditSessionIdentity; options: QuickEditOptions }> {
  if (field === 'room') {
    const [session, options] = await Promise.all([
      getQuickEditSessionIdentity(sessionId),
      getRoomOptions(),
    ]);
    return { session, options };
  }

  if (field === 'trainer') {
    const [session, options] = await Promise.all([
      getQuickEditSessionIdentity(sessionId),
      getTrainerOptions(),
    ]);
    return { session, options };
  }

  const session = await getQuickEditSessionIdentity(sessionId);
  const options = await getScheduleOptions(session.academicPeriodId);
  return { session, options };
}
