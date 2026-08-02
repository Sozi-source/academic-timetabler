import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatMinutesAsTime,
  getIntervalDurationMinutes,
  parseTimeToMinutes,
  resolveMinuteInterval,
  TimetableTimeError,
} from '@/features/timetable-generator';

describe('timetable time utilities', () => {
  it('parses HH:mm values', () => {
    expect(
      parseTimeToMinutes('08:30'),
    ).toBe(510);
  });

  it('parses PostgreSQL HH:mm:ss values', () => {
    expect(
      parseTimeToMinutes('14:15:00'),
    ).toBe(855);
  });

  it('calculates interval duration', () => {
    expect(
      getIntervalDurationMinutes({
        startsAt: '08:00',
        endsAt: '10:30',
      }),
    ).toBe(150);
  });

  it('rejects an interval ending before it starts', () => {
    expect(() =>
      resolveMinuteInterval({
        startsAt: '12:00',
        endsAt: '10:00',
      }),
    ).toThrow(TimetableTimeError);
  });

  it('rejects an interval with equal boundaries', () => {
    expect(() =>
      resolveMinuteInterval({
        startsAt: '10:00',
        endsAt: '10:00',
      }),
    ).toThrow(TimetableTimeError);
  });

  it('rejects invalid hours', () => {
    expect(() =>
      parseTimeToMinutes('25:00'),
    ).toThrow(TimetableTimeError);
  });

  it('formats minute values as HH:mm', () => {
    expect(
      formatMinutesAsTime(485),
    ).toBe('08:05');
  });
});