import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatDailyReportDate,
  formatDailyReportTime,
  normalizeDailyReportDate,
} from '@/features/trainer-daily-report/domain';

describe('trainer daily report domain', () => {
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
});
