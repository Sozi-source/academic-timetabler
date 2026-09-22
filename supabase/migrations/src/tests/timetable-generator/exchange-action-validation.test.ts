import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  isProtectedTimetableExchangeError,
} from '@/features/timetable-generator';

describe('trainer exchange action validation', () => {
  it('recognizes the confirmed reopen requirement', () => {
    expect(isProtectedTimetableExchangeError(
      'Confirm that the active timetable may be reopened before applying this exchange',
    )).toBe(true);
  });

  it('recognizes the v9.1 protected timetable message', () => {
    expect(isProtectedTimetableExchangeError(
      'Return the active timetable to an editable draft before applying this exchange',
    )).toBe(true);
  });

  it('does not request a reopen for an ordinary exchange rejection', () => {
    expect(isProtectedTimetableExchangeError(
      'The exchange would exceed a trainer maximum',
    )).toBe(false);
  });

});
