import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  allowedReleaseDefectStatuses,
  releaseDefectBlocksSignoff,
  releaseDefectNeedsResolutionNote,
  releaseGoLiveLabel,
} from '@/features/system-testing/release-controls-domain';

import type {
  ReleaseGoLiveStatus,
} from '@/features/system-testing/release-controls-types';

describe('release control domain', () => {
  it('blocks go-live for every unresolved Critical or High defect', () => {
    expect(
      releaseDefectBlocksSignoff({
        severity: 'critical',
        status: 'fixed',
      }),
    ).toBe(true);

    expect(
      releaseDefectBlocksSignoff({
        severity: 'high',
        status: 'deferred',
      }),
    ).toBe(true);

    expect(
      releaseDefectBlocksSignoff({
        severity: 'high',
        status: 'closed',
      }),
    ).toBe(false);

    expect(
      releaseDefectBlocksSignoff({
        severity: 'medium',
        status: 'open',
      }),
    ).toBe(false);
  });

  it('uses controlled defect transitions', () => {
    expect(
      allowedReleaseDefectStatuses('open'),
    ).toEqual([
      'open',
      'in_progress',
      'deferred',
    ]);

    expect(
      allowedReleaseDefectStatuses('fixed'),
    ).toEqual([
      'fixed',
      'retest',
      'open',
    ]);
  });

  it('requires evidence when a defect is fixed, closed or deferred', () => {
    expect(releaseDefectNeedsResolutionNote('fixed')).toBe(true);
    expect(releaseDefectNeedsResolutionNote('closed')).toBe(true);
    expect(releaseDefectNeedsResolutionNote('deferred')).toBe(true);
    expect(releaseDefectNeedsResolutionNote('open')).toBe(false);
  });

  it('distinguishes eligible and approved go-live state', () => {
    const base: ReleaseGoLiveStatus = {
      eligible: true,
      signoffValid: false,
      blockerDefects: 0,
      warningDefects: 1,
      activeCatalogCaseCount: 21,
      passedRunCaseCount: 21,
      reasons: [],
      latestPassedRun: {
        id: 'run-1',
        suiteVersion: '2026.1',
        completedAt: '2026-08-22T10:00:00.000Z',
      },
      activeSignoff: null,
    };

    expect(releaseGoLiveLabel(base)).toBe('Eligible');

    expect(
      releaseGoLiveLabel({
        ...base,
        signoffValid: true,
        activeSignoff: {
          id: 'signoff-1',
          verificationRef: 'RC-1',
          approvedAt: '2026-08-22T11:00:00.000Z',
        },
      }),
    ).toBe('Signed off');

    expect(
      releaseGoLiveLabel({
        ...base,
        eligible: false,
        signoffValid: false,
        activeSignoff: {
          id: 'signoff-1',
          verificationRef: 'RC-1',
          approvedAt: '2026-08-22T11:00:00.000Z',
        },
      }),
    ).toBe('Sign-off stale');
  });
});
