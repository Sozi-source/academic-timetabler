import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  CalendarEventType,
  ConstraintSubjectType,
  SchedulingConstraintData,
  TimetableCalendarEvent,
} from './types';

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes('timetable_calendar_events') === true
  );
}

export const getSchedulingConstraintData = cache(
  async (academicPeriodId: string): Promise<SchedulingConstraintData> => {
    const supabase = await createClient();

    const [
      constraintResult,
      trainerResult,
      roomResult,
      cohortResult,
      dayResult,
      timeSlotResult,
      eventResult,
    ] = await Promise.all([
      supabase
        .from('scheduling_constraints')
        .select('*')
        .eq('academic_period_id', academicPeriodId)
        .order('created_at', { ascending: false }),
      supabase
        .from('trainers')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('rooms')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code'),
      supabase
        .from('cohorts')
        .select('id, name')
        .in('status', ['planned', 'active'])
        .order('name'),
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
        .from('timetable_calendar_events')
        .select('*')
        .eq('academic_period_id', academicPeriodId)
        .order('event_date', { ascending: true }),
    ]);

    const failure =
      constraintResult.error ??
      trainerResult.error ??
      roomResult.error ??
      cohortResult.error ??
      dayResult.error ??
      timeSlotResult.error ??
      (isMissingTableError(eventResult.error) ? null : eventResult.error);

    if (failure) {
      throw new Error(
        `Unable to load scheduling constraints: ${failure.message}`,
      );
    }

    const trainers = (trainerResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.full_name,
    }));

    const rooms = (roomResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.code,
    }));

    const cohorts = (cohortResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.name,
    }));

    const workingDays = (dayResult.data ?? []).map((item) => ({
      id: item.id,
      label:
        item.day_of_week.charAt(0).toUpperCase() +
        item.day_of_week.slice(1),
      sequenceNumber: item.sequence_number,
    }));

    const timeSlots = (timeSlotResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      startsAt: item.starts_at.slice(0, 5),
      endsAt: item.ends_at.slice(0, 5),
      sequenceNumber: item.sequence_number,
    }));

    const labels = new Map<string, string>(
      [...trainers, ...rooms, ...cohorts].map((item) => [item.id, item.label]),
    );

    const dayLabels = new Map(
      workingDays.map((item) => [item.id, item.label]),
    );

    const calendarEvents: TimetableCalendarEvent[] = (
      isMissingTableError(eventResult.error) ? [] : (eventResult.data ?? [])
    ).map((row) => ({
      id: row.id,
      academicPeriodId: row.academic_period_id,
      title: row.title,
      eventType: row.event_type as CalendarEventType,
      eventDate: row.event_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      scopeType: row.scope_type as ConstraintSubjectType,
      scopeId: row.scope_id,
      scopeLabel:
        row.scope_type === 'institution'
          ? 'Institution-wide'
          : labels.get(row.scope_id ?? '') ?? 'Unknown record',
      suspendsRegularClasses: Boolean(row.suspends_regular_classes),
      notes: row.notes ?? null,
      isActive: Boolean(row.is_active),
    }));

    return {
      trainers,
      rooms,
      cohorts,
      workingDays,
      timeSlots,
      calendarEvents,
      constraints: (constraintResult.data ?? []).map((row) => ({
        id: row.id,
        academicPeriodId: row.academic_period_id,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        subjectLabel:
          row.subject_type === 'institution'
            ? 'Institution-wide'
            : labels.get(row.subject_id ?? '') ?? 'Unknown record',
        constraintType: row.constraint_type,
        workingDayId: row.working_day_id,
        workingDayLabel: row.working_day_id
          ? dayLabels.get(row.working_day_id) ?? 'Unknown day'
          : null,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        priority: row.priority,
        reason: row.reason,
        isActive: row.is_active,
      })),
    };
  },
);
