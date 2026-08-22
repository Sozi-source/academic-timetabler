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
  ReleaseDeployment,
} from '@/features/production-controls/types';
import type {
  ReleaseDefect,
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
  latestPassedRun: {
    id: 'run-1',
    suiteVersion: '1',
    completedAt: '2026-08-22T08:00:00.000Z',
  },
  activeSignoff: {
    id: 'signoff-1',
    verificationRef: 'RC-20260822-abc',
    approvedAt: '2026-08-22T08:10:00.000Z',
  },
};

function defect(
  overrides: Partial<ReleaseDefect> = {},
): ReleaseDefect {
  return {
    id: 'defect-1',
    defectNumber: 1,
    runId: null,
    caseKey: null,
    suiteVersion: null,
    severity: 'medium',
    status: 'open',
    title: 'Defect',
    description: 'Description',
    resolutionNote: null,
    createdAt: '2026-08-22T08:00:00.000Z',
    updatedAt: '2026-08-22T08:00:00.000Z',
    ...overrides,
  };
}

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

function productionDeployment(): ReleaseDeployment {
  return {
    id: 'deployment-1',
    environment: 'production',
    versionLabel: 'v1',
    releaseSignoffId: 'signoff-1',
    releaseTestRunId: 'run-1',
    suiteVersion: '1',
    verificationRef: 'RC-20260822-abc',
    status: 'deployed',
    note: null,
    deployedAt: '2026-08-22T08:20:00.000Z',
    deployedByName: null,
    rolledBackAt: null,
    rollbackReason: null,
  };
}

describe('operations action center', () => {
  it('is empty when operational and release controls are clear', () => {
    expect(
      buildActionCenter({
        readiness,
        goLive,
        defects: [],
        deployments: [productionDeployment()],
        incidents: [],
      }),
    ).toEqual([]);
  });

  it('promotes release and production blockers to critical', () => {
    const items = buildActionCenter({
      readiness,
      goLive,
      defects: [defect({ severity: 'high' })],
      deployments: [productionDeployment()],
      incidents: [incident({ severity: 'critical' })],
    });

    expect(items.slice(0, 2).every((item) => item.severity === 'critical')).toBe(true);
    expect(actionCenterCounts(items).critical).toBe(2);
  });

  it('adds a deployment follow-up after valid sign-off when Production is not recorded', () => {
    const items = buildActionCenter({
      readiness,
      goLive,
      defects: [],
      deployments: [],
      incidents: [],
    });

    expect(items).toContainEqual(
      expect.objectContaining({
        id: 'production-deployment',
        severity: 'info',
      }),
    );
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
      deployments: [productionDeployment()],
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
