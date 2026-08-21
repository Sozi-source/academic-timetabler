import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateOnlineFinalTotal,
  calculateRatCatAverage,
  missingOnlineComponentCount,
  onlineMarkComponents,
  parseOnlineMarkInput,
} from '@/features/staff-assessment/online-marks-domain';

describe('online marks domain', () => {
  it('mirrors the existing Excel source fields and caps', () => {
    expect(
      onlineMarkComponents,
    ).toEqual([
      {
        key:
          'assignment',
        label:
          'Assignment',
        maximum:
          5,
      },
      {
        key:
          'presentation',
        label:
          'Presentation',
        maximum:
          10,
      },
      {
        key:
          'rat',
        label:
          'RAT',
        maximum:
          15,
      },
      {
        key:
          'cat',
        label:
          'CAT',
        maximum:
          15,
      },
      {
        key:
          'exam',
        label:
          'Exam',
        maximum:
          70,
      },
    ]);
  });

  it('averages RAT and CAT into one fifteen-mark contribution', () => {
    expect(
      calculateRatCatAverage({
        rat:
          12,
        cat:
          14,
      }),
    ).toBe(
      13,
    );

    expect(
      calculateOnlineFinalTotal(
        {
          assignment:
            5,
          presentation:
            10,
          rat:
            12,
          cat:
            14,
          exam:
            60,
        },
        false,
      ),
    ).toBe(
      88,
    );
  });

  it('keeps exam absence distinct while still requiring coursework', () => {
    expect(
      calculateOnlineFinalTotal(
        {
          assignment:
            5,
          presentation:
            10,
          rat:
            12,
          cat:
            14,
          exam:
            null,
        },
        true,
      ),
    ).toBeNull();

    expect(
      missingOnlineComponentCount({
        values: {
          assignment:
            5,
          presentation:
            10,
          rat:
            12,
          cat:
            14,
          exam:
            null,
        },
        absent:
          true,
      }),
    ).toBe(
      0,
    );
  });

  it('returns a stable validation object for TypeScript-safe UI messaging', () => {
    expect(
      parseOnlineMarkInput(
        '16',
        15,
      ),
    ).toEqual({
      valid:
        false,
      mark:
        null,
      message:
        'Mark must be between 0 and 15.',
    });

    expect(
      parseOnlineMarkInput(
        '',
        15,
      ),
    ).toEqual({
      valid:
        true,
      mark:
        null,
      message:
        null,
    });
  });
});
