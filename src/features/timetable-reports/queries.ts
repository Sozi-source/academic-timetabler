import 'server-only';

import { cache } from 'react';

import { getTimetableEditorData } from '@/features/timetable-editor/queries';

import { buildTimetableReports } from './aggregation';
import type { TimetableReportsData } from './types';

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
      unitCode: session.unitCode,
      unitName: session.unitName,
      trainer: session.trainerName,
      roomCode: session.roomCode,
      roomName: session.roomName,
      status: session.status,
      isLocked: session.isLocked,
    };
  });

  return buildTimetableReports(rows);
});
