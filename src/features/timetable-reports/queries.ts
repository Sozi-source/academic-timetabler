import 'server-only';

import { cache } from 'react';

import { getTimetableEditorData } from '@/features/timetable-editor/queries';
import { createClient } from '@/lib/supabase/server';

import { buildTimetableReports } from './aggregation';
import type { TimetableReportRow, TimetableReportsData } from './types';

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export const getTimetableReportsData = cache(async (
  academicPeriodId: string,
): Promise<TimetableReportsData> => {
  const editor = await getTimetableEditorData(academicPeriodId);
  const dayMap = new Map(editor.workingDays.map((day) => [day.id, day]));
  const slotMap = new Map(editor.timeSlots.map((slot) => [slot.id, slot]));

  const rows = editor.sessions.map((session) => {
    const day = dayMap.get(session.workingDayId);
    const startSlot = slotMap.get(session.startTimeSlotId);
    const endSlot = slotMap.get(session.endTimeSlotId);
    const startsAt = startSlot?.startsAt.slice(0, 5) ?? '00:00';
    const endsAt = endSlot?.endsAt.slice(0, 5) ?? startsAt;
    const durationMinutes = Math.max(
      0,
      timeToMinutes(endsAt) - timeToMinutes(startsAt),
    );

    return {
      sessionId: session.id,
      day: day?.label ?? 'Unassigned day',
      daySequence: day?.sequenceNumber ?? 99,
      startsAt,
      endsAt,
      durationMinutes,
      cohort: session.cohortName,
      cohortSize: session.cohortSize,
      participantCohorts: session.participantCohorts,
      unitCode: session.unitCode,
      unitName: session.unitName,
      trainerId: session.trainerId,
      trainer: session.trainerName,
      trainerTargetHours: session.trainerTargetHours,
      roomCode: session.roomCode,
      roomName: session.roomName,
      status: session.status,
      isLocked: session.isLocked,
    };
  });

  return buildTimetableReports(rows);
});

interface InstitutionTrainerTimetableRow {
  session_id: string;
  working_day_label: string;
  day_sequence: number;
  starts_at: string;
  ends_at: string;
  cohort_id: string;
  cohort_code: string;
  cohort_name: string;
  cohort_size: number;
  participant_cohorts: Array<{
    id: string;
    code: string;
    name: string;
  }> | null;
  unit_code: string;
  unit_name: string;
  trainer_id: string;
  trainer_name: string;
  trainer_target_hours: number | string;
  room_code: string | null;
  room_name: string;
  session_status: string;
  is_locked: boolean;
  department_code: string;
  department_name: string;
}

export const getInstitutionTrainerTimetableReportsData = cache(async (
  academicPeriodId: string,
): Promise<TimetableReportsData> => {
  const supabase = await createClient();
  const [sessionResult, workloadResult, trainerResult] = await Promise.all([
    supabase.rpc(
      'get_institution_trainer_timetable_rows',
      { target_academic_period_id: academicPeriodId },
    ),
    supabase.rpc(
      'get_institution_trainer_workloads',
      { target_academic_period_id: academicPeriodId },
    ),
    supabase.from('trainers')
      .select('id, full_name, normal_weekly_hours')
      .eq('is_active', true),
  ]);

  const error = sessionResult.error ?? workloadResult.error ?? trainerResult.error;
  if (error) {
    throw new Error(
      `Unable to load institution trainer timetables: ${error.message}`,
    );
  }

  const rows: TimetableReportRow[] = (
    (sessionResult.data ?? []) as InstitutionTrainerTimetableRow[]
  ).map((row) => {
    const startsAt = row.starts_at.slice(0, 5);
    const endsAt = row.ends_at.slice(0, 5);

    return {
      sessionId: row.session_id,
      day: row.working_day_label,
      daySequence: row.day_sequence,
      startsAt,
      endsAt,
      durationMinutes: Math.max(
        0,
        timeToMinutes(endsAt) - timeToMinutes(startsAt),
      ),
      cohort: row.cohort_name,
      cohortSize: Number(row.cohort_size),
      participantCohorts: row.participant_cohorts?.length
        ? row.participant_cohorts
        : [{
            id: row.cohort_id,
            code: row.cohort_code,
            name: row.cohort_name,
          }],
      unitCode: row.unit_code,
      unitName: row.unit_name,
      trainerId: row.trainer_id,
      trainer: row.trainer_name,
      trainerTargetHours: Number(row.trainer_target_hours),
      roomCode: row.room_code,
      roomName: row.room_name,
      departmentCode: row.department_code,
      departmentName: row.department_name,
      status: row.session_status,
      isLocked: row.is_locked,
    };
  });

  const report = buildTimetableReports(rows);
  const trainers = new Map((trainerResult.data ?? []).map((trainer) => [
    trainer.id,
    trainer,
  ]));
  const scheduledByTrainer = new Map(report.byTrainer.map((group) => [
    group.key,
    group,
  ]));

  report.workload = (workloadResult.data ?? []).map((workload) => {
    const scheduled = scheduledByTrainer.get(workload.trainer_id);
    const trainer = trainers.get(workload.trainer_id);
    const targetHours = scheduled?.targetHours
      ?? Number(trainer?.normal_weekly_hours ?? 0);
    const allocatedHours = Number(workload.allocated_hours);

    return {
      key: workload.trainer_id,
      label: scheduled?.label ?? trainer?.full_name ?? 'Trainer',
      sessionCount: scheduled?.sessionCount ?? 0,
      contactHours: scheduled?.contactHours ?? 0,
      allocatedHours,
      targetHours,
      extraHours: Math.max(0, Math.round((allocatedHours - targetHours) * 10) / 10),
      rows: scheduled?.rows ?? [],
    };
  }).sort((left, right) =>
    (right.allocatedHours ?? 0) - (left.allocatedHours ?? 0)
      || left.label.localeCompare(right.label));

  return report;
});
