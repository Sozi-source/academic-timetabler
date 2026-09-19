import 'server-only';

import { cache } from 'react';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getTimetableEnabledAllocations } from '@/features/teaching-allocations/queries';
import { createClient } from '@/lib/supabase/server';

import { loadParticipantResolver } from './participant-integrity';
import type { EditorData, EditorSession } from './types';

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const getTimetableEditorData = cache(async (
  academicPeriodId: string,
): Promise<EditorData> => {
  const supabase = await createClient();

  const participantResolver = await loadParticipantResolver(supabase, academicPeriodId);

  const [
    profile,
    sessionResult,
    timetableAllocations,
    dayResult,
    slotResult,
    roomResult,
    cohortResult,
    trainerResult,
    workloadResult,
  ] = await Promise.all([
    getAuthenticatedProfile(),
    supabase
      .from('scheduled_sessions')
      .select(`
        id,
        teaching_allocation_id,
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
    getTimetableEnabledAllocations(academicPeriodId),
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
    supabase
      .from('trainers')
      .select('id, full_name, staff_number, home_department, department_id, normal_weekly_hours, workload_role')
      .eq('is_active', true)
      .eq('is_timetable_available', true)
      .order('full_name'),
    supabase.rpc('get_institution_trainer_workloads', {
      target_academic_period_id: academicPeriodId,
    }),
  ]);

  const failure = sessionResult.error
    ?? dayResult.error
    ?? slotResult.error
    ?? roomResult.error
    ?? cohortResult.error
    ?? trainerResult.error
    ?? workloadResult.error;
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

    const storedParticipantIds = Array.from(new Set([
      ...((row.participant_cohort_ids as string[] | null) ?? []),
      ...(cohort?.id ? [cohort.id] : []),
    ]));
    // Ignore cohorts that no longer hold a live unit offering for this shared class —
    // a stale entry here is reported to the HOD as a phantom "cohort already has" clash.
    const participantIds = cohort?.id
      ? participantResolver.sanitize(
          cohort.id,
          participantResolver.offeringIdForAllocation(row.teaching_allocation_id),
          storedParticipantIds,
        )
      : storedParticipantIds;
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

  const workloads = new Map<string, number>(
    (workloadResult.data ?? []).map((w: any) => [w.trainer_id, Number(w.allocated_hours)]),
  );

  const missingAllocations = timetableAllocations.flatMap((allocation) => {
    const activeSessionCount = (sessionResult.data ?? []).filter(
      (session) => session.teaching_allocation_id === allocation.id,
    ).length;
    const expectedSessionCount = Number(allocation.weeklySessions);
    const missingSessionCount = Math.max(0, expectedSessionCount - activeSessionCount);

    const participantIds = participantResolver.sanitize(
      allocation.cohortId,
      participantResolver.offeringIdForAllocation(allocation.id),
      Array.from(new Set([
        ...(allocation.participantCohortIds ?? []),
        allocation.cohortId,
      ])),
    );
    const participantCohorts = participantIds
      .map((id) => {
        const c = cohortDirectory.get(id);
        return c ? { id: c.id, code: c.code } : null;
      })
      .filter((c): c is { id: string; code: string } => Boolean(c));
    const participantCodes = participantCohorts.map((c) => c.code);
    const isSharedClass = participantCodes.length > 1;

    return missingSessionCount > 0
      ? [{
          id: allocation.id,
          unitCode: allocation.unit?.code ?? 'Unit',
          unitName: allocation.unit?.name ?? 'Unknown unit',
          cohortCode: allocation.cohort?.code ?? 'Unknown cohort',
          trainerName: allocation.trainer?.fullName ?? 'Unassigned trainer',
          cohortId: allocation.cohortId,
          unitId: allocation.unitId,
          trainerId: allocation.trainerId,
          missingSessionCount,
          expectedSessionCount,
          participantCohortIds: participantIds,
          participantCohortCodes: participantCodes,
          participantCohorts,
          isSharedClass,
        }]
      : [];
  });

  return {
    sessions,
    missingAllocations,
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
      name: room.name,
      label: room.code,
      capacity: room.capacity,
    })),
    trainers: (trainerResult.data ?? []).map((t) => ({
      id: t.id,
      fullName: t.full_name,
      staffNumber: t.staff_number,
      homeDepartment: t.home_department,
      departmentId: t.department_id,
      normalWeeklyHours: Number(t.normal_weekly_hours),
      workloadRole: t.workload_role,
      allocatedHours: workloads.get(t.id) ?? 0,
    })),
    profile,
  };
});
