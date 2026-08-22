import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  attendanceCountLabel,
  attendanceRate,
  attendanceRateLabel,
} from '@/features/attendance-analytics/domain';

describe('attendance analytics domain', () => {
  it('calculates attendance from present and absent only', () => {
    expect(
      attendanceRate({
        present:
          9,
        absent:
          1,
      }),
    ).toBe(
      90,
    );
  });

  it('does not invent a rate when no completed attendance exists', () => {
    expect(
      attendanceRate({
        present:
          0,
        absent:
          0,
      }),
    ).toBeNull();

    expect(
      attendanceRateLabel(
        null,
      ),
    ).toBe(
      '—',
    );
  });

  it('keeps display copy concise', () => {
    expect(
      attendanceRateLabel(
        87.5,
      ),
    ).toBe(
      '87.5%',
    );

    expect(
      attendanceCountLabel({
        present:
          7,
        absent:
          2,
      }),
    ).toBe(
      '7 present · 2 absent',
    );
  });
});
