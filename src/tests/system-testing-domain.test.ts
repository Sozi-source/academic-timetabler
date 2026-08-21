import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildTestingAreas,
  testingReadyCount,
  testingStatusLabel,
} from '@/features/system-testing/domain';
import type {
  TestingSnapshot,
} from '@/features/system-testing/types';

function snapshot(
  overrides:
    Partial<TestingSnapshot> = {},
): TestingSnapshot {
  return {
    departmentId:
      'department-1',
    activePeriod: {
      id:
        'period-1',
      name:
        'Sep-Dec 2026',
    },
    students: {
      total:
        40,
      active:
        36,
    },
    studentPortal: {
      issued:
        36,
      active:
        36,
    },
    timetable: {
      allocations:
        12,
      publishedSessions:
        24,
    },
    assessments: {
      total:
        8,
      published:
        2,
    },
    documents: {
      activeTemplates:
        4,
      total:
        10,
      submitted:
        1,
      approved:
        5,
      studentVisible:
        2,
      studentDownloads:
        3,
    },
    attendance: {
      sessions:
        6,
      open:
        1,
      completed:
        5,
    },
    ...overrides,
  };
}

describe('system testing domain', () => {
  it('marks all core areas ready when operational test data exists', () => {
    const areas =
      buildTestingAreas(
        snapshot(),
      );

    expect(
      testingReadyCount(
        areas,
      ),
    ).toBe(
      6,
    );
  });

  it('flags partial student portal rollout without blocking other areas', () => {
    const areas =
      buildTestingAreas(
        snapshot({
          studentPortal: {
            issued:
              12,
            active:
              10,
          },
        }),
      );

    expect(
      areas.find(
        (area) =>
          area.key ===
          'student-portal',
      )?.status,
    ).toBe(
      'attention',
    );

    expect(
      areas.find(
        (area) =>
          area.key ===
          'timetable',
      )?.status,
    ).toBe(
      'ready',
    );
  });

  it('does not call an empty module ready for testing', () => {
    const areas =
      buildTestingAreas(
        snapshot({
          timetable: {
            allocations:
              0,
            publishedSessions:
              0,
          },
          attendance: {
            sessions:
              0,
            open:
              0,
            completed:
              0,
          },
        }),
      );

    expect(
      areas.find(
        (area) =>
          area.key ===
          'timetable',
      )?.status,
    ).toBe(
      'not_started',
    );

    expect(
      areas.find(
        (area) =>
          area.key ===
          'attendance',
      )?.status,
    ).toBe(
      'not_started',
    );
  });

  it('uses concise testing labels', () => {
    expect(
      testingStatusLabel(
        'ready',
      ),
    ).toBe(
      'Ready to test',
    );

    expect(
      testingStatusLabel(
        'attention',
      ),
    ).toBe(
      'Needs attention',
    );
  });
});
