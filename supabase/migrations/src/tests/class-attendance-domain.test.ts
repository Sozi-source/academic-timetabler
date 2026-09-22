import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ABSENT_CIRCUMSTANCES,
  canCompleteClassAttendance,
  classAttendanceOptions,
  classAttendanceStatusLabel,
  classAttendanceStatusVariant,
  classAttendanceSummary,
  formatStudentTwoNames,
  weekdayLabel,
} from '@/features/class-attendance/domain';

describe('class attendance domain', () => {
  it('provides predefined unavoidable absence circumstances', () => {
    expect(ABSENT_CIRCUMSTANCES).toContain('Leave of absence');
    expect(ABSENT_CIRCUMSTANCES).toContain('Pending unit registration');
    expect(ABSENT_CIRCUMSTANCES).toContain('Medical / Sickness');
    expect(ABSENT_CIRCUMSTANCES).toContain('Official college duty');
  });
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

  });

  it('summarises present, absent and unmarked attendance', () => {
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

  it('blocks completion until every student is marked', () => {
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

  it('formats student names to two primary names for native mobile display', () => {
    expect(formatStudentTwoNames('OCHIENG, BRIDGITE ATIENO')).toBe('OCHIENG BRIDGITE');
    expect(formatStudentTwoNames('Mary Wanjiku Kamau')).toBe('Mary Wanjiku');
    expect(formatStudentTwoNames('KIPKORIR JOHN')).toBe('KIPKORIR JOHN');
    expect(formatStudentTwoNames('MERCY')).toBe('MERCY');
    expect(formatStudentTwoNames('')).toBe('');
    expect(formatStudentTwoNames(null)).toBe('');
  });
});
