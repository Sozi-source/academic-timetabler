import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  activeDeployment,
  allowedIncidentStatuses,
  incidentBlocksProduction,
  incidentNeedsResolutionNote,
} from '@/features/production-controls/domain';
import type {
  ProductionIncident,
  ReleaseDeployment,
} from '@/features/production-controls/types';

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
    createdByName: 'HOD',
    ...overrides,
  };
}

function deployment(
  overrides: Partial<ReleaseDeployment> = {},
): ReleaseDeployment {
  return {
    id: 'deployment-1',
    environment: 'pilot',
    versionLabel: 'RC-1',
    releaseSignoffId: null,
    releaseTestRunId: 'run-1',
    suiteVersion: '1',
    verificationRef: null,
    status: 'deployed',
    note: null,
    deployedAt: '2026-08-22T08:00:00.000Z',
    deployedByName: 'HOD',
    rolledBackAt: null,
    rollbackReason: null,
    ...overrides,
  };
}

describe('production controls domain', () => {
  it('blocks Production only for active Critical/High incidents', () => {
    expect(
      incidentBlocksProduction(
        incident({ severity: 'critical', status: 'open' }),
      ),
    ).toBe(true);

    expect(
      incidentBlocksProduction(
        incident({ severity: 'high', status: 'investigating' }),
      ),
    ).toBe(true);

    expect(
      incidentBlocksProduction(
        incident({ severity: 'high', status: 'resolved' }),
      ),
    ).toBe(false);

    expect(
      incidentBlocksProduction(
        incident({ severity: 'medium', status: 'open' }),
      ),
    ).toBe(false);
  });

  it('uses controlled incident transitions', () => {
    expect(allowedIncidentStatuses('open')).toEqual([
      'open',
      'investigating',
      'resolved',
    ]);

    expect(allowedIncidentStatuses('resolved')).toEqual([
      'resolved',
      'open',
      'closed',
    ]);
  });

  it('requires resolution evidence before Resolved or Closed', () => {
    expect(incidentNeedsResolutionNote('resolved')).toBe(true);
    expect(incidentNeedsResolutionNote('closed')).toBe(true);
    expect(incidentNeedsResolutionNote('investigating')).toBe(false);
  });

  it('returns only the currently deployed environment record', () => {
    const deployments = [
      deployment({ id: 'old', status: 'superseded' }),
      deployment({ id: 'pilot', status: 'deployed' }),
      deployment({ id: 'prod', environment: 'production', status: 'deployed' }),
    ];

    expect(activeDeployment(deployments, 'pilot')?.id).toBe('pilot');
    expect(activeDeployment(deployments, 'production')?.id).toBe('prod');
  });
});
