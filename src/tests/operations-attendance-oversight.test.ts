import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  classAttendanceStatusLabel,
  classAttendanceSummary,
} from '@/features/class-attendance/domain';

describe('attendance oversight release policy', () => {
  it('retains Present / Absent as the only final attendance statuses', () => {
    expect(
      classAttendanceStatusLabel(
        'present',
      ),
    ).toBe(
      'Present',
    );

    expect(
      classAttendanceStatusLabel(
        'absent',
      ),
    ).toBe(
      'Absent',
    );
  });

  it('keeps unmarked separate until trainer completion', () => {
    expect(
      classAttendanceSummary([
        'present',
        'absent',
        'unmarked',
      ]),
    ).toEqual({
      total:
        3,
      present:
        1,
      absent:
        1,
      notReported:
        0,
      unmarked:
        1,
    });
  });
});
