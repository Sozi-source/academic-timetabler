import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  attendanceCountLabel,
  attendanceRate,
  attendanceRateLabel,
  getAttendanceBadgeVariant,
  getAttendanceStanding,
} from '@/features/attendance-analytics/domain';

describe('attendance analytics domain', () => {
  it('calculates attendance from present and absent only', () => {
    expect(
      attendanceRate({
        present:
          9,
        absent:
          1,
      }),
    ).toBe(
      90,
    );
  });

  it('does not invent a rate when no completed attendance exists', () => {
    expect(
      attendanceRate({
        present:
          0,
        absent:
          0,
      }),
    ).toBeNull();

    expect(
      attendanceRateLabel(
        null,
      ),
    ).toBe(
      '—',
    );
  });

  it('keeps display copy concise', () => {
    expect(
      attendanceRateLabel(
        87.5,
      ),
    ).toBe(
      '87.5%',
    );

    expect(
      attendanceCountLabel({
        present:
          7,
        absent:
          2,
      }),
    ).toBe(
      '7 present · 2 absent',
    );
  });

  it('classifies student attendance based on 80% college minimum threshold', () => {
    // Below 80% is at risk
    expect(getAttendanceStanding(79.9)).toBe('at_risk');
    expect(getAttendanceStanding(75.0)).toBe('at_risk');
    expect(getAttendanceStanding(50.0)).toBe('at_risk');
    expect(getAttendanceBadgeVariant(79.9)).toBe('danger');

    // 80% to 84.9% is borderline (cleared)
    expect(getAttendanceStanding(80.0)).toBe('borderline');
    expect(getAttendanceStanding(84.9)).toBe('borderline');
    expect(getAttendanceBadgeVariant(80.0)).toBe('warning');

    // >= 85% is in good standing
    expect(getAttendanceStanding(85.0)).toBe('good');
    expect(getAttendanceStanding(100.0)).toBe('good');
    expect(getAttendanceBadgeVariant(95.0)).toBe('success');

    // null / unrecorded
    expect(getAttendanceStanding(null)).toBe('unrecorded');
    expect(getAttendanceBadgeVariant(null)).toBe('neutral');
  });
});

