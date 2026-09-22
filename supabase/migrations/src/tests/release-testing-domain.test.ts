import { describe, expect, it } from 'vitest';

import {
  canCompleteReleaseRun,
  releaseCaseNeedsNote,
  releaseCaseSummary,
  releaseOutcomeLabel,
  releaseReadinessLabel,
} from '@/features/system-testing/release-domain';
import type { ReleaseTestCase, ReleaseTestRun } from '@/features/system-testing/release-types';

function testCase(
  result: ReleaseTestCase['result'],
  key = 'TEST-01',
): ReleaseTestCase {
  return {
    id: key,
    runId: 'run-1',
    caseKey: key,
    area: 'System',
    title: 'Test',
    expectedResult: 'Expected',
    requirementLevel: 'required',
    sequenceNumber: 1,
    result,
    note: null,
    testedAt: null,
  };
}

function run(
  status: ReleaseTestRun['status'] = 'in_progress',
): Pick<ReleaseTestRun, 'status'> {
  return { status };
}

describe('release testing domain', () => {
  it('requires every case to be resolved before completion', () => {
    expect(
      canCompleteReleaseRun(run(), [testCase('pass'), testCase('fail', 'TEST-02')]),
    ).toBe(true);

    expect(
      canCompleteReleaseRun(run(), [testCase('pass'), testCase('pending', 'TEST-02')]),
    ).toBe(false);

    expect(canCompleteReleaseRun(run('completed'), [testCase('pass')])).toBe(false);
  });

  it('keeps pass, fail, blocked and pending distinct', () => {
    expect(
      releaseCaseSummary([
        testCase('pass'),
        testCase('fail', 'TEST-02'),
        testCase('blocked', 'TEST-03'),
        testCase('pending', 'TEST-04'),
      ]),
    ).toEqual({
      total: 4,
      pending: 1,
      passed: 1,
      failed: 1,
      blocked: 1,
    });
  });

  it('requires evidence notes for fail and blocked outcomes', () => {
    expect(releaseCaseNeedsNote('fail')).toBe(true);
    expect(releaseCaseNeedsNote('blocked')).toBe(true);
    expect(releaseCaseNeedsNote('pass')).toBe(false);
  });

  it('uses concise readiness and release labels', () => {
    expect(releaseReadinessLabel('blocker')).toBe('Blocker');
    expect(releaseOutcomeLabel('passed')).toBe('Passed');
    expect(releaseOutcomeLabel('pending')).toBe('In progress');
  });
});
