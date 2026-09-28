import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatDailyReportDate,
  formatDailyReportTime,
  getAbsenteeColumnClass,
  formatAbsenteeLine,
  normalizeDailyReportDate,
  shiftDailyReportDate,
} from '@/features/trainer-daily-report/domain';

describe('trainer daily report domain', () => {
  it('correctly shifts report dates backward and forward', () => {
    expect(shiftDailyReportDate('2026-08-24', -1)).toBe('2026-08-23');
    expect(shiftDailyReportDate('2026-08-24', 1)).toBe('2026-08-25');
    expect(shiftDailyReportDate('2026-09-01', -1)).toBe('2026-08-31');
  });
  it('keeps a valid ISO report date', () => {
    expect(
      normalizeDailyReportDate(
        '2026-08-24',
      ),
    ).toBe(
      '2026-08-24',
    );
  });

  it('formats timetable times for trainer and HOD views', () => {
    expect(
      formatDailyReportTime(
        '08:00:00',
      ),
    ).toBe(
      '8:00 AM',
    );

    expect(
      formatDailyReportTime(
        '14:00:00',
      ),
    ).toBe(
      '2:00 PM',
    );
  });

  it('formats management report dates consistently', () => {
    expect(
      formatDailyReportDate(
        '2026-08-24',
      ),
    ).toBe(
      'Monday, 24 August 2026',
    );
  });

  it('determines absentee straight-column grid classes based on population size', () => {
    expect(getAbsenteeColumnClass(0)).toBe('grid-cols-1');
    expect(getAbsenteeColumnClass(3)).toBe('grid-cols-1');
    expect(getAbsenteeColumnClass(5)).toBe('grid-cols-1 sm:grid-cols-2');
    expect(getAbsenteeColumnClass(8)).toBe('grid-cols-1 sm:grid-cols-2');
    expect(getAbsenteeColumnClass(12)).toBe('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    expect(getAbsenteeColumnClass(16)).toBe('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    expect(getAbsenteeColumnClass(17)).toBe('grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4');
    expect(getAbsenteeColumnClass(32)).toBe('grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4');
  });

  it('formats single-line absentee student details with optional circumstance note', () => {
    expect(
      formatAbsenteeLine({
        fullName: 'AHMED , SIAMA ABEID',
        admissionNumber: 'CHN/J-4929/IC/25',
      }),
    ).toBe('AHMED , SIAMA ABEID (CHN/J-4929/IC/25)');

    expect(
      formatAbsenteeLine({
        fullName: 'CHERONO, SHEILA',
        admissionNumber: 'CND/S-6274/IC/25',
        note: 'Leave of absence',
      }),
    ).toBe('CHERONO, SHEILA (CND/S-6274/IC/25) [Leave of absence]');
  });
});
