import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canCompleteClassAttendance,
  classAttendanceOptions,
  classAttendanceStatusLabel,
  classAttendanceStatusVariant,
  classAttendanceSummary,
  weekdayLabel,
} from '@/features/class-attendance/domain';

describe('class attendance domain', () => {
  it('uses only present and absent as final attendance states', () => {
    expect(
      classAttendanceOptions,
    ).toEqual([
      {
        value:
          'present',
        label:
          'Present',
        shortLabel:
          'P',
      },
      {
        value:
          'absent',
        label:
          'Absent',
        shortLabel:
          'A',
      },
    ]);

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

  it('summarises present, absent and unmarked without extra states', () => {
    expect(
      classAttendanceSummary([
        'present',
        'present',
        'absent',
        'unmarked',
      ]),
    ).toEqual({
      total:
        4,
      present:
        2,
      absent:
        1,
      unmarked:
        1,
    });
  });

  it('blocks completion until every student is present or absent', () => {
    expect(
      canCompleteClassAttendance([
        'present',
        'absent',
      ]),
    ).toBe(
      true,
    );

    expect(
      canCompleteClassAttendance([
        'present',
        'unmarked',
      ]),
    ).toBe(
      false,
    );
  });

  it('keeps concise visual states and weekday labels', () => {
    expect(
      classAttendanceStatusVariant(
        'present',
      ),
    ).toBe(
      'success',
    );

    expect(
      classAttendanceStatusVariant(
        'absent',
      ),
    ).toBe(
      'danger',
    );

    expect(
      weekdayLabel(
        'wednesday',
      ),
    ).toBe(
      'Wednesday',
    );
  });
});
