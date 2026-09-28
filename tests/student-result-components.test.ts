import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  studentResultComponentDisplay,
} from '@/features/student-portal/domain';

describe('student result component display', () => {
  it('shows stored component marks against their institutional caps', () => {
    expect(
      studentResultComponentDisplay(
        5,
        5,
      ),
    ).toBe(
      '5/5',
    );

    expect(
      studentResultComponentDisplay(
        12,
        15,
      ),
    ).toBe(
      '12/15',
    );

    expect(
      studentResultComponentDisplay(
        61,
        70,
      ),
    ).toBe(
      '61/70',
    );
  });

  it('keeps unavailable historical components explicit', () => {
    expect(
      studentResultComponentDisplay(
        null,
        15,
      ),
    ).toBe(
      '—',
    );
  });
});
