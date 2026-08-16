import { describe, expect, it } from 'vitest';

import { getMasterSessionPresentation } from '@/features/timetable-reports/master-presentation';
import type { TimetableReportRow } from '@/features/timetable-reports/types';

const row: TimetableReportRow = {
  sessionId: 'session-1',
  day: 'Monday',
  daySequence: 1,
  startsAt: '08:00',
  endsAt: '10:00',
  durationMinutes: 120,
  cohort: 'CND September 2026',
  cohortSize: 35,
  participantCohorts: [],
  unitCode: 'CND 1101',
  unitName: 'Communication Skills',
  trainerId: 'trainer-1',
  trainer: 'Trainer A',
  trainerTargetHours: 20,
  roomCode: null,
  roomName: 'No room assigned',
  status: 'draft',
  isLocked: false,
};

describe('master timetable presentation', () => {
  it('shows the unit name without its unit code', () => {
    const presentation = getMasterSessionPresentation(row);

    expect(presentation.unitName).toBe('Communication Skills');
    expect(Object.values(presentation).join(' ')).not.toContain('CND 1101');
  });

  it('labels the current venue as unallocated', () => {
    expect(getMasterSessionPresentation(row).venue).toBe('Unallocated');
  });

  it('uses a future assigned room name as the venue', () => {
    expect(getMasterSessionPresentation({
      ...row,
      roomCode: 'LAB-1',
      roomName: 'Nutrition Laboratory',
    }).venue).toBe('Nutrition Laboratory');
  });
});
