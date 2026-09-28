import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  operationsReadinessIssues,
  operationsReadinessScore,
} from '@/features/operations/domain';
import type {
  OperationsSnapshot,
} from '@/features/operations/types';

function readySnapshot():
OperationsSnapshot {
  return {
    activePeriodId:
      'period-1',
    activePeriodName:
      'Sep-Dec 2026',

    students: {
      eligible:
        40,
      portalIssued:
        40,
      portalActive:
        40,
      registered:
        40,
      unregistered:
        0,
    },

    timetable: {
      activeAllocations:
        8,
      publishedSessions:
        16,
    },

    assessment: {
      total:
        8,
      submitted:
        0,
      finalised:
        8,
      published:
        8,
    },

    documents: {
      activeTemplates:
        4,
      inProgress:
        0,
      submitted:
        0,
      returned:
        0,
      approved:
        16,
    },

    attendance: {
      open:
        0,
      completed:
        12,
    },
  };
}

describe('operations readiness', () => {
  it('reports a fully ready operational snapshot', () => {
    const snapshot =
      readySnapshot();

    expect(
      operationsReadinessIssues(
        snapshot,
      ),
    ).toEqual(
      [],
    );

    expect(
      operationsReadinessScore(
        snapshot,
      ),
    ).toBe(
      100,
    );
  });

  it('treats missing active period and allocations as critical', () => {
    const snapshot =
      readySnapshot();

    snapshot.activePeriodId =
      null;

    snapshot.activePeriodName =
      null;

    const issues =
      operationsReadinessIssues(
        snapshot,
      );

    expect(
      issues,
    ).toHaveLength(
      1,
    );

    expect(
      issues[0]?.severity,
    ).toBe(
      'critical',
    );
  });

  it('surfaces registration, portal and returned-document gaps', () => {
    const snapshot =
      readySnapshot();

    snapshot.students.portalActive =
      35;

    snapshot.students.registered =
      38;

    snapshot.students.unregistered =
      2;

    snapshot.documents.returned =
      3;

    const ids =
      operationsReadinessIssues(
        snapshot,
      ).map(
        (issue) =>
          issue.id,
      );

    expect(
      ids,
    ).toContain(
      'student-access',
    );

    expect(
      ids,
    ).toContain(
      'unit-registration',
    );

    expect(
      ids,
    ).toContain(
      'returned-documents',
    );
  });

  it('keeps informational work separate from hard blockers', () => {
    const snapshot =
      readySnapshot();

    snapshot.assessment.finalised =
      6;

    snapshot.attendance.open =
      2;

    const issues =
      operationsReadinessIssues(
        snapshot,
      );

    expect(
      issues.every(
        (issue) =>
          issue.severity ===
          'info',
      ),
    ).toBe(
      true,
    );
  });
});
