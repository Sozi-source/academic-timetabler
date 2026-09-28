import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import {
  normalizeParticipantCohortIds,
} from '@/features/timetable-generator/participant-cohorts';

import { detectTimetableConflictCenter } from './detector';
import type {
  ConflictCenterData,
  ConflictConstraint,
  ConflictReview,
  ConflictSession,
} from './types';

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;

export const getTimetableConflictCenterData = cache(async (
  academicPeriodId: string,
): Promise<ConflictCenterData> => {
  const supabase = await createClient();
  const [
    sessionResult,
    constraintResult,
    reviewResult,
    availabilityResult,
    timeSlotResult,
  ] = await Promise.all([
    supabase.from('scheduled_sessions').select(`
      id, teaching_allocation_id, cohort_id, unit_id, trainer_id, room_id,
      working_day_id, start_time_slot_id, end_time_slot_id,
      status, conflict_state, is_locked,
      participant_cohort_ids, combined_cohort_size,
      cohorts ( name, actual_size ), units ( code, name ),
      trainers (
        full_name,
        availability_mode,
        normal_weekly_hours,
        maximum_weekly_hours,
        maximum_daily_hours
      ),
      teaching_allocations ( is_full_day_session ),
      rooms ( code, name, capacity ), working_days ( day_of_week, sequence_number ),
      start_slot:time_slots!scheduled_sessions_start_time_slot_id_fkey ( starts_at ),
      end_slot:time_slots!scheduled_sessions_end_time_slot_id_fkey ( ends_at )
    `).eq('academic_period_id', academicPeriodId).in('status', ['draft', 'confirmed', 'locked']),
    supabase.from('scheduling_constraints').select(`
      id, subject_type, subject_id, constraint_type, working_day_id,
      starts_at, ends_at, priority, reason
    `).eq('academic_period_id', academicPeriodId).eq('is_active', true),
    supabase.from('timetable_conflict_reviews').select(`
      conflict_key, status, resolution_note, updated_at
    `).eq('academic_period_id', academicPeriodId),
    supabase.from('trainer_availability').select(`
      trainer_id, working_day_id, time_slot_id
    `).eq('academic_period_id', academicPeriodId),
    supabase.from('time_slots').select(`
      id, sequence_number, slot_type, is_enabled
    `).eq('academic_period_id', academicPeriodId),
  ]);

  const failure = sessionResult.error
    ?? constraintResult.error
    ?? reviewResult.error
    ?? availabilityResult.error
    ?? timeSlotResult.error;
  if (failure) throw new Error(`Unable to load the Conflict Centre: ${failure.message}`);

  const sessions: ConflictSession[] = (sessionResult.data ?? []).map((row) => {
    const cohort = first(row.cohorts as Relation<{ name: string; actual_size: number }>);
    const unit = first(row.units as Relation<{ code: string; name: string }>);
    const trainer = first(row.trainers as Relation<{
      full_name: string;
      availability_mode: 'generally_available' | 'selected_slots_only';
      normal_weekly_hours: number | string;
      maximum_weekly_hours: number | string;
      maximum_daily_hours: number | string;
    }>);
    const allocation = first(row.teaching_allocations as Relation<{
      is_full_day_session: boolean;
    }>);
    const room = first(row.rooms as Relation<{ code: string; name: string; capacity: number }>);
    const day = first(row.working_days as Relation<{ day_of_week: string; sequence_number: number }>);
    const start = first(row.start_slot as Relation<{ starts_at: string }>);
    const end = first(row.end_slot as Relation<{ ends_at: string }>);
    return {
      id: row.id,
      teachingAllocationId: row.teaching_allocation_id,
      cohortId: row.cohort_id,
      cohortName: cohort?.name ?? 'Unknown cohort',
      cohortSize: cohort?.actual_size ?? 0,
      participantCohortIds:
        normalizeParticipantCohortIds({
          cohortId: row.cohort_id,
          participantCohortIds:
            row.participant_cohort_ids,
        }),
      combinedCohortSize:
        row.combined_cohort_size ??
        cohort?.actual_size ??
        0,
      unitId: row.unit_id,
      unitCode: unit?.code ?? '—',
      unitName: unit?.name ?? 'Unknown unit',
      trainerId: row.trainer_id,
      trainerName: trainer?.full_name ?? 'Unassigned trainer',
      trainerAvailabilityMode: trainer?.availability_mode ?? 'generally_available',
      trainerNormalWeeklyHours: Number(trainer?.normal_weekly_hours ?? 0),
      trainerMaximumWeeklyHours: Number(trainer?.maximum_weekly_hours ?? 0),
      trainerMaximumDailyHours: Number(trainer?.maximum_daily_hours ?? 0),
      roomId: row.room_id,
      roomCode: room?.code ?? null,
      roomName: room?.name ?? 'No room assigned',
      roomCapacity: room?.capacity ?? 0,
      workingDayId: row.working_day_id,
      workingDayLabel: day?.day_of_week ? day.day_of_week.charAt(0).toUpperCase() + day.day_of_week.slice(1) : 'Unknown day',
      startTimeSlotId: row.start_time_slot_id,
      startTime: start?.starts_at ?? '00:00:00',
      endTimeSlotId: row.end_time_slot_id,
      endTime: end?.ends_at ?? '00:00:00',
      status: row.status,
      conflictState: row.conflict_state,
      isLocked: row.is_locked,
      isFullDaySession: allocation?.is_full_day_session ?? false,
    };
  });

  const constraints = (constraintResult.data ?? []).map((row) => ({
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    constraintType: row.constraint_type,
    workingDayId: row.working_day_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    priority: row.priority,
    reason: row.reason,
  })) as ConflictConstraint[];

  const reviews = (reviewResult.data ?? []).map((row) => ({
    conflictKey: row.conflict_key,
    status: row.status,
    resolutionNote: row.resolution_note,
    updatedAt: row.updated_at,
  })) as ConflictReview[];

  const conflicts = detectTimetableConflictCenter(
    sessions,
    constraints,
    reviews,
    {
      availableSlots: (availabilityResult.data ?? []).map((row) => ({
        trainerId: row.trainer_id,
        workingDayId: row.working_day_id,
        timeSlotId: row.time_slot_id,
      })),
      timeSlots: (timeSlotResult.data ?? []).map((row) => ({
        id: row.id,
        sequenceNumber: row.sequence_number,
        slotType: row.slot_type,
        isEnabled: row.is_enabled,
      })),
    },
  );
  return {
    conflicts,
    sessions,
    summary: {
      total: conflicts.length,
      blocked: conflicts.filter((item) => item.severity === 'blocked' && item.review?.status !== 'resolved').length,
      errors: conflicts.filter((item) => item.severity === 'error' && item.review?.status !== 'resolved').length,
      warnings: conflicts.filter((item) => item.severity === 'warning' && item.review?.status !== 'resolved').length,
      acknowledged: conflicts.filter((item) => item.review?.status === 'acknowledged').length,
      resolved: conflicts.filter((item) => item.review?.status === 'resolved').length,
    },
  };
});
