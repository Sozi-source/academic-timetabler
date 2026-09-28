import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  actionCenterCounts,
  buildActionCenter,
} from '@/features/operations/action-center-domain';
import type {
  OperationsReadiness,
} from '@/features/operations/types';
import type {
  ProductionIncident,
} from '@/features/production-controls/types';
import type {
  ReleaseGoLiveStatus,
} from '@/features/system-testing/release-controls-types';

const readiness: OperationsReadiness = {
  activePeriodId: 'period-1',
  students: {
    eligible: 10,
    accessIssued: 10,
    accessActive: 10,
    accessMissing: 0,
  },
  attendance: {
    open: 0,
    completed: 10,
    incomplete: 0,
  },
  documents: {
    awaitingReview: 0,
    returned: 0,
    approvedUnpublished: 0,
    studentPublished: 4,
  },
  assessments: {
    total: 4,
    submitted: 4,
    finalised: 4,
    finalisedUnpublished: 0,
  },
};

const goLive: ReleaseGoLiveStatus = {
  eligible: true,
  signoffValid: true,
  blockerDefects: 0,
  warningDefects: 0,
  activeCatalogCaseCount: 10,
  passedRunCaseCount: 10,
  reasons: [],
  latestPassedRun: null,
  activeSignoff: null,
};

function incident(
  overrides: Partial<ProductionIncident> = {},
): ProductionIncident {
  return {
    id: 'incident-1',
    incidentNumber: 1,
    deploymentId: null,
    deploymentVersionLabel: null,
    environment: 'production',
    severity: 'medium',
    status: 'open',
    title: 'Incident',
    description: 'Description',
    resolutionNote: null,
    createdAt: '2026-08-22T08:00:00.000Z',
    updatedAt: '2026-08-22T08:00:00.000Z',
    createdByName: null,
    ...overrides,
  };
}

describe('operations action center', () => {
  it('is empty when operational controls are clear', () => {
    expect(
      buildActionCenter({
        readiness,
        goLive,
        defects: [],
        deployments: [],
        incidents: [],
      }),
    ).toEqual([]);
  });

  it('promotes critical operational incidents to top severity', () => {
    const items = buildActionCenter({
      readiness,
      goLive,
      defects: [],
      deployments: [],
      incidents: [incident({ severity: 'critical' })],
    });

    expect(items[0]?.severity).toBe('critical');
    expect(actionCenterCounts(items).critical).toBe(1);
  });

  it('includes existing operational gaps without duplicating data stores', () => {
    const items = buildActionCenter({
      readiness: {
        ...readiness,
        students: {
          ...readiness.students,
          accessMissing: 2,
        },
      },
      goLive,
      defects: [],
      deployments: [],
      incidents: [],
    });

    expect(items).toContainEqual(
      expect.objectContaining({
        id: 'student-access',
        href: '/students/access',
      }),
    );
  });
});
