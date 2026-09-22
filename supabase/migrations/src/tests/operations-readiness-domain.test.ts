import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  operationsAttentionCount,
  operationsReadinessState,
} from '@/features/operations/domain';
import type {
  OperationsReadiness,
} from '@/features/operations/types';

function readiness(
  overrides:
    Partial<OperationsReadiness> = {},
): OperationsReadiness {
  return {
    activePeriodId:
      'period-1',
    students: {
      eligible:
        100,
      accessIssued:
        100,
      accessActive:
        100,
      accessMissing:
        0,
    },
    attendance: {
      open:
        0,
      completed:
        10,
      incomplete:
        0,
    },
    documents: {
      awaitingReview:
        0,
      returned:
        0,
      approvedUnpublished:
        0,
      studentPublished:
        4,
    },
    assessments: {
      total:
        8,
      submitted:
        0,
      finalised:
        8,
      finalisedUnpublished:
        0,
    },
    ...overrides,
  };
}

describe('operations readiness domain', () => {
  it('is ready when no release blockers remain', () => {
    expect(
      operationsReadinessState(
        readiness(),
      ),
    ).toBe(
      'ready',
    );

    expect(
      operationsAttentionCount(
        readiness(),
      ),
    ).toBe(
      0,
    );
  });

  it('counts only actionable release blockers', () => {
    const data =
      readiness({
        students: {
          eligible:
            100,
          accessIssued:
            97,
          accessActive:
            95,
          accessMissing:
            3,
        },
        attendance: {
          open:
            2,
          completed:
            8,
          incomplete:
            1,
        },
        documents: {
          awaitingReview:
            2,
          returned:
            1,
          approvedUnpublished:
            4,
          studentPublished:
            3,
        },
        assessments: {
          total:
            8,
          submitted:
            2,
          finalised:
            4,
          finalisedUnpublished:
            2,
        },
      });

    expect(
      operationsAttentionCount(
        data,
      ),
    ).toBe(
      9,
    );

    expect(
      operationsReadinessState(
        data,
      ),
    ).toBe(
      'attention',
    );
  });
});
