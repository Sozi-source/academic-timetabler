import { describe, expect, it } from 'vitest';

import { buildTimetableReports } from '@/features/timetable-reports/aggregation';
import type { TimetableReportRow } from '@/features/timetable-reports/types';

const rows: TimetableReportRow[] = [
  {
    sessionId: '1', day: 'Monday', daySequence: 1, startsAt: '08:00', endsAt: '10:00', durationMinutes: 120,
    cohort: 'CND SEPT 26', cohortSize: 30, unitCode: 'CND 1101', unitName: 'Communication Skills', trainer: 'Trainer A', roomCode: 'R1', roomName: 'Room 1', status: 'draft', isLocked: false,
  },
  {
    sessionId: '2', day: 'Wednesday', daySequence: 3, startsAt: '10:00', endsAt: '12:00', durationMinutes: 120,
    cohort: 'DND SEPT 26', cohortSize: 40, unitCode: 'DND 1101', unitName: 'Communication Skills', trainer: 'Trainer A', roomCode: 'R2', roomName: 'Room 2', status: 'locked', isLocked: true,
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
  });
});
