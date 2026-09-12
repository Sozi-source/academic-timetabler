import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatTimetableClock,
  historyTimestamp,
  mergeStaffTimetableSessions,
} from '@/features/staff-workspace/domain';
import type {
  StaffTimetableSession,
} from '@/features/staff-workspace/types';

function session(
  overrides:
    Partial<StaffTimetableSession> =
      {},
): StaffTimetableSession {
  return {
    id:
      's1',
    allocationId:
      null,
    academicPeriodId:
      'p1',
    academicPeriodName:
      'September–December 2026',
    academicPeriodCode:
      'SEP-DEC-26',
    dayName:
      'monday',
    daySequence:
      1,
    startSequence:
      1,
    startsAt:
      '08:00:00',
    endsAt:
      '10:00:00',
    unitId:
      'u1',
    unitName:
      'Nutrition Epidemiology',
    cohortNames: [
      'DHN SEPT 25',
    ],
    roomLabel:
      'Unallocated',
    deliveryMode:
      'theory',
    sessionNumbers: [
      1,
    ],
    ...overrides,
  };
}

describe('staff timetable domain', () => {
  it('merges the same teaching session across participating cohorts', () => {
    const result =
      mergeStaffTimetableSessions([
        session(),
        session({
          id:
            's2',
          cohortNames: [
            'DNDT SEPT 25',
          ],
        }),
      ]);

    expect(
      result,
    ).toHaveLength(
      1,
    );

    expect(
      result[0]
        .cohortNames,
    ).toEqual([
      'DHN SEPT 25',
      'DNDT SEPT 25',
    ]);
  });

  it('keeps different teaching times separate', () => {
    const result =
      mergeStaffTimetableSessions([
        session(),
        session({
          id:
            's2',
          startSequence:
            2,
          startsAt:
            '10:30:00',
          endsAt:
            '12:30:00',
        }),
      ]);

    expect(
      result,
    ).toHaveLength(
      2,
    );
  });

  it('formats teaching time compactly', () => {
    expect(
      formatTimetableClock(
        '08:00:00',
      ),
    ).toBe(
      '8:00 AM',
    );

    expect(
      formatTimetableClock(
        '14:00:00',
      ),
    ).toBe(
      '2:00 PM',
    );
  });

  it('sorts missing history timestamps safely', () => {
    expect(
      historyTimestamp(
        null,
      ),
    ).toBe(
      0,
    );
  });
});
