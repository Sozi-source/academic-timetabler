import type {
  ReleaseReadinessStatus,
  ReleaseTestCase,
  ReleaseTestCaseResult,
  ReleaseTestOutcome,
  ReleaseTestRequirement,
  ReleaseTestRun,
} from './release-types';

export function releaseReadinessVariant(
  status: ReleaseReadinessStatus,
): 'success' | 'warning' | 'danger' {
  if (status === 'pass') return 'success';
  if (status === 'warning') return 'warning';
  return 'danger';
}

export function releaseReadinessLabel(
  status: ReleaseReadinessStatus,
): string {
  if (status === 'pass') return 'Pass';
  if (status === 'warning') return 'Warning';
  return 'Blocker';
}

export function releaseCaseResultLabel(
  result: ReleaseTestCaseResult,
): string {
  switch (result) {
    case 'pass':
      return 'Pass';
    case 'fail':
      return 'Fail';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Pending';
  }
}

export function releaseCaseResultVariant(
  result: ReleaseTestCaseResult,
): 'success' | 'danger' | 'warning' | 'neutral' {
  switch (result) {
    case 'pass':
      return 'success';
    case 'fail':
      return 'danger';
    case 'blocked':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function releaseRequirementLabel(
  value: ReleaseTestRequirement,
): string {
  switch (value) {
    case 'critical':
      return 'Critical';
    case 'required':
      return 'Required';
    default:
      return 'Advisory';
  }
}

export function releaseOutcomeLabel(
  outcome: ReleaseTestOutcome,
): string {
  switch (outcome) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'In progress';
  }
}

export function releaseOutcomeVariant(
  outcome: ReleaseTestOutcome,
): 'success' | 'danger' | 'neutral' | 'warning' {
  switch (outcome) {
    case 'passed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warning';
  }
}

export function releaseCaseSummary(
  cases: ReleaseTestCase[],
) {
  const count = (result: ReleaseTestCaseResult) =>
    cases.filter((testCase) => testCase.result === result).length;

  return {
    total: cases.length,
    pending: count('pending'),
    passed: count('pass'),
    failed: count('fail'),
    blocked: count('blocked'),
  };
}

export function canCompleteReleaseRun(
  run: Pick<ReleaseTestRun, 'status'>,
  cases: ReleaseTestCase[],
): boolean {
  return (
    run.status === 'in_progress' &&
    cases.length > 0 &&
    cases.every((testCase) => testCase.result !== 'pending')
  );
}

export function releaseCaseNeedsNote(
  result: ReleaseTestCaseResult,
): boolean {
  return result === 'fail' || result === 'blocked';
}

export function formatTestingDateTime(
  value: string | null,
): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
