import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assessmentAttendanceStatusLabels,
} from '@/features/assessment/domain';

describe('assessment population workspace', () => {
  it('keeps absence explicit', () => {
    expect(
      assessmentAttendanceStatusLabels
        .expected,
    ).toBe('Expected');

    expect(
      assessmentAttendanceStatusLabels
        .absent,
    ).toBe('Absent');
  });

  it('does not model blank marks as absence', () => {
    expect(
      Object.keys(
        assessmentAttendanceStatusLabels,
      ),
    ).toEqual([
      'expected',
      'absent',
    ]);
  });
});
