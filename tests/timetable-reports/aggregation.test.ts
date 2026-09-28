import { describe, expect, it } from 'vitest';

import { buildTimetableReports } from '@/features/timetable-reports/aggregation';
import type { TimetableReportRow } from '@/features/timetable-reports/types';

const rows: TimetableReportRow[] = [
  {
    sessionId: '1', day: 'Monday', daySequence: 1, startsAt: '08:00', endsAt: '10:00', durationMinutes: 120,
    cohort: 'CND SEPT 26', cohortSize: 30, participantCohorts: [{ id: 'cnd', code: 'CND-SEP-26', name: 'CND SEPT 26' }], unitCode: 'CND 1101', unitName: 'Communication Skills', trainerId: 'trainer-a', trainer: 'Trainer A', trainerTargetHours: 3, roomCode: 'R1', roomName: 'Room 1', departmentCode: 'HND', departmentName: 'Human Nutrition and Dietetics', status: 'draft', isLocked: false,
  },
  {
    sessionId: '2', day: 'Wednesday', daySequence: 3, startsAt: '10:00', endsAt: '12:00', durationMinutes: 120,
    cohort: 'DND SEPT 26', cohortSize: 40, participantCohorts: [{ id: 'dnd', code: 'DND-SEP-26', name: 'DND SEPT 26' }], unitCode: 'DND 1101', unitName: 'Communication Skills', trainerId: 'trainer-a', trainer: 'Trainer A', trainerTargetHours: 3, roomCode: 'R2', roomName: 'Room 2', departmentCode: 'NUR', departmentName: 'Nursing', status: 'locked', isLocked: true,
  },
];

describe('buildTimetableReports', () => {
  it('calculates enterprise report summary totals', () => {
    const result = buildTimetableReports(rows);

    expect(result.summary.totalSessions).toBe(2);
    expect(result.summary.totalContactHours).toBe(4);
    expect(result.summary.distinctCohorts).toBe(2);
    expect(result.summary.distinctTrainers).toBe(1);
    expect(result.summary.lockedSessions).toBe(1);
  });

  it('groups trainer workload and preserves contact hours', () => {
    const result = buildTimetableReports(rows);

    expect(result.workload).toHaveLength(1);
    expect(result.workload[0].label).toBe('Trainer A');
    expect(result.workload[0].sessionCount).toBe(2);
    expect(result.workload[0].contactHours).toBe(4);
    expect(result.workload[0].targetHours).toBe(3);
    expect(result.workload[0].extraHours).toBe(1);
    expect(new Set(
      result.workload[0].rows.map((row) => row.departmentCode),
    )).toEqual(new Set(['HND', 'NUR']));
  });

  it('keeps unassigned sessions in master totals but excludes them from personal timetables', () => {
    const result = buildTimetableReports([
      ...rows,
      {
        ...rows[0],
        sessionId: '3',
        unitCode: 'DND 1204',
        unitName: 'Diet Therapy III',
        trainerId: null,
        trainer: 'Unassigned trainer',
        trainerTargetHours: 0,
      },
    ]);

    expect(result.summary.totalSessions).toBe(3);
    expect(result.summary.distinctTrainers).toBe(1);
    expect(result.byTrainer).toHaveLength(1);
    expect(result.byTrainer[0].rows).toHaveLength(2);
  });
});
