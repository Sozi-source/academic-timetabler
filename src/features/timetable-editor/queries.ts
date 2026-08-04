import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type { EditorData, EditorSession } from './types';

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const getTimetableEditorData = cache(async (
  academicPeriodId: string,
): Promise<EditorData> => {
  const supabase = await createClient();

  const [sessionResult, dayResult, slotResult, roomResult] = await Promise.all([
    supabase
      .from('scheduled_sessions')
      .select(`
        id,
        academic_period_id,
        working_day_id,
        start_time_slot_id,
        end_time_slot_id,
        room_id,
        status,
        source,
        conflict_state,
        is_locked,
        notes,
        session_number,
        cohorts ( name, actual_size ),
        units ( name, code ),
        trainers ( full_name ),
        rooms ( name, code )
      `)
      .eq('academic_period_id', academicPeriodId)
      .in('status', ['draft', 'confirmed', 'locked'])
      .order('session_number'),
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
    supabase
      .from('rooms')
      .select('id, code, name, capacity')
      .eq('is_active', true)
      .eq('is_timetable_available', true)
      .order('code'),
  ]);

  const failure = sessionResult.error ?? dayResult.error ?? slotResult.error ?? roomResult.error;
  if (failure) {
    throw new Error(`Unable to load the timetable editor: ${failure.message}`);
  }

  const sessions: EditorSession[] = (sessionResult.data ?? []).map((row) => {
    const cohort = first(row.cohorts as Relation<{ name: string; actual_size: number }>);
    const unit = first(row.units as Relation<{ name: string; code: string }>);
    const trainer = first(row.trainers as Relation<{ full_name: string }>);
    const room = first(row.rooms as Relation<{ name: string; code: string }>);

    return {
      id: row.id,
      academicPeriodId: row.academic_period_id,
      workingDayId: row.working_day_id,
      startTimeSlotId: row.start_time_slot_id,
      endTimeSlotId: row.end_time_slot_id,
      roomId: row.room_id,
      status: row.status,
      source: row.source,
      conflictState: row.conflict_state,
      isLocked: row.is_locked,
      notes: row.notes,
      sessionNumber: row.session_number,
      cohortName: cohort?.name ?? 'Unknown cohort',
      cohortSize: cohort?.actual_size ?? 0,
      unitName: unit?.name ?? 'Unknown unit',
      unitCode: unit?.code ?? '—',
      trainerName: trainer?.full_name ?? 'Unassigned trainer',
      roomName: room?.name ?? 'Unknown room',
      roomCode: room?.code ?? '—',
    };
  });

  return {
    sessions,
    workingDays: (dayResult.data ?? []).map((day) => ({
      id: day.id,
      label: day.day_of_week.charAt(0).toUpperCase() + day.day_of_week.slice(1),
      sequenceNumber: day.sequence_number,
    })),
    timeSlots: (slotResult.data ?? []).map((slot) => ({
      id: slot.id,
      label: `${slot.name} · ${slot.starts_at.slice(0, 5)}–${slot.ends_at.slice(0, 5)}`,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      sequenceNumber: slot.sequence_number,
    })),
    rooms: (roomResult.data ?? []).map((room) => ({
      id: room.id,
      label: `${room.code} · ${room.name} (${room.capacity})`,
      capacity: room.capacity,
    })),
  };
});
