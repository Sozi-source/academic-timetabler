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
        'not_reported',
      ),
    ).toBe(
      'Not Reported',
    );
  });

  it('summarises present, absent, not_reported and unmarked', () => {
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
      notReported:
        0,
      unmarked:
        1,
    });

    expect(
      classAttendanceSummary([
        'present',
        'not_reported',
        'absent',
      ]),
    ).toEqual({
      total:
        3,
      present:
        1,
      absent:
        1,
      notReported:
        1,
      unmarked:
        0,
    });
  });

  it('blocks completion until every student is marked or not_reported', () => {
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
        'not_reported',
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
