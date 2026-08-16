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

  const [sessionResult, dayResult, slotResult, roomResult, cohortResult] = await Promise.all([
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
        participant_cohort_ids,
        combined_cohort_size,
        cohorts ( id, code, name, actual_size ),
        units ( name, code ),
        trainers ( id, full_name, normal_weekly_hours ),
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
    supabase
      .from('cohorts')
      .select('id, code, name, actual_size')
      .order('code'),
  ]);

  const failure = sessionResult.error
    ?? dayResult.error
    ?? slotResult.error
    ?? roomResult.error
    ?? cohortResult.error;
  if (failure) {
    throw new Error(`Unable to load the timetable editor: ${failure.message}`);
  }

  const cohortDirectory = new Map(
    (cohortResult.data ?? []).map((cohort) => [cohort.id, cohort]),
  );

  const sessions: EditorSession[] = (sessionResult.data ?? []).map((row) => {
    const cohort = first(row.cohorts as Relation<{
      id: string;
      code: string;
      name: string;
      actual_size: number;
    }>);
    const unit = first(row.units as Relation<{ name: string; code: string }>);
    const trainer = first(row.trainers as Relation<{ id: string; full_name: string; normal_weekly_hours: number | string }>);
    const room = first(row.rooms as Relation<{ name: string; code: string }>);

    const participantIds = Array.from(new Set([
      ...((row.participant_cohort_ids as string[] | null) ?? []),
      ...(cohort?.id ? [cohort.id] : []),
    ]));
    const participantCohorts = participantIds
      .map((id) => cohortDirectory.get(id))
      .filter((participant): participant is {
        id: string;
        code: string;
        name: string;
        actual_size: number;
      } => Boolean(participant))
      .map((participant) => ({
        id: participant.id,
        code: participant.code,
        name: participant.name,
      }));

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
      cohortCode: cohort?.code ?? 'Unknown cohort',
      cohortName: cohort?.name ?? 'Unknown cohort',
      cohortSize: Number(row.combined_cohort_size) || cohort?.actual_size || 0,
      participantCohorts,
      unitName: unit?.name ?? 'Unknown unit',
      unitCode: unit?.code ?? '—',
      trainerId: trainer?.id ?? null,
      trainerName: trainer?.full_name ?? 'Unassigned trainer',
      trainerTargetHours: trainer ? Number(trainer.normal_weekly_hours) : 0,
      roomName: room?.name ?? 'No room assigned',
      roomCode: room?.code ?? null,
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
