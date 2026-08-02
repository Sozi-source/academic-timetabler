import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getOverlapDurationMinutes,
  intervalContains,
  intervalsAreAdjacent,
  timeIntervalsOverlap,
} from '@/features/timetable-generator';

describe('timeIntervalsOverlap', () => {
  it('detects a partial overlap', () => {
    expect(
      timeIntervalsOverlap(
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
        {
          startsAt: '09:30',
          endsAt: '11:00',
        },
      ),
    ).toBe(true);
  });

  it('detects a complete overlap', () => {
    expect(
      timeIntervalsOverlap(
        {
          startsAt: '08:00',
          endsAt: '12:00',
        },
        {
          startsAt: '09:00',
          endsAt: '10:00',
        },
      ),
    ).toBe(true);
  });

  it('detects identical intervals', () => {
    expect(
      timeIntervalsOverlap(
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
      ),
    ).toBe(true);
  });

  it('does not treat adjacent intervals as overlapping', () => {
    expect(
      timeIntervalsOverlap(
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
        {
          startsAt: '10:00',
          endsAt: '12:00',
        },
      ),
    ).toBe(false);
  });

  it('does not detect separated intervals', () => {
    expect(
      timeIntervalsOverlap(
        {
          startsAt: '08:00',
          endsAt: '09:00',
        },
        {
          startsAt: '11:00',
          endsAt: '12:00',
        },
      ),
    ).toBe(false);
  });
});

describe('overlap helpers', () => {
  it('calculates overlap duration', () => {
    expect(
      getOverlapDurationMinutes(
        {
          startsAt: '08:00',
          endsAt: '10:30',
        },
        {
          startsAt: '09:45',
          endsAt: '11:00',
        },
      ),
    ).toBe(45);
  });

  it('returns zero overlap for adjacent intervals', () => {
    expect(
      getOverlapDurationMinutes(
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
        {
          startsAt: '10:00',
          endsAt: '12:00',
        },
      ),
    ).toBe(0);
  });

  it('detects contained intervals', () => {
    expect(
      intervalContains(
        {
          startsAt: '08:00',
          endsAt: '12:00',
        },
        {
          startsAt: '09:00',
          endsAt: '10:00',
        },
      ),
    ).toBe(true);
  });

  it('detects adjacent intervals', () => {
    expect(
      intervalsAreAdjacent(
        {
          startsAt: '08:00',
          endsAt: '10:00',
        },
        {
          startsAt: '10:00',
          endsAt: '11:30',
        },
      ),
    ).toBe(true);
  });
});