import { describe, expect, it } from 'vitest';

import { formatStudyPeriod } from '@/lib/study-period-label';

describe('formatStudyPeriod', () => {
  it.each([
    [1, 'Y1S1'],
    [2, 'Y1S2'],
    [3, 'Y1S3'],
    [4, 'Y2S1'],
    [5, 'Y2S2'],
    [6, 'Y2S3'],
    [7, 'Y3S1'],
    [8, 'Y3S2'],
    [9, 'Y3S3'],
  ])(
    'formats programme period %i as %s',
    (period, expected) => {
      expect(
        formatStudyPeriod(period),
      ).toBe(expected);
    },
  );

  it('handles invalid values safely', () => {
    expect(formatStudyPeriod(0)).toBe('â€”');
    expect(formatStudyPeriod(undefined)).toBe('â€”');
  });
});