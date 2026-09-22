import { describe, expect, it } from 'vitest';

import {
  getAutomaticTimetableVersionTitle,
  getNextTimetableVersionNumber,
} from '@/features/timetable-publication/workflow';

describe('timetable publication workflow', () => {
  it('increments the largest existing version number', () => {
    expect(getNextTimetableVersionNumber([])).toBe(1);
    expect(getNextTimetableVersionNumber([1, 4, 2])).toBe(5);
  });

  it('uses the Academic Period name in the automatic title', () => {
    expect(
      getAutomaticTimetableVersionTitle(' Sep–Dec 2026 ', 3),
    ).toBe('Sep–Dec 2026 · v3');
  });
});
