import type {
  ReleaseDefect,
  ReleaseDefectSeverity,
  ReleaseDefectStatus,
  ReleaseGoLiveStatus,
} from './release-controls-types';

const transitions: Record<
  ReleaseDefectStatus,
  readonly ReleaseDefectStatus[]
> = {
  open: [
    'in_progress',
    'deferred',
  ],
  in_progress: [
    'fixed',
    'deferred',
    'open',
  ],
  fixed: [
    'retest',
    'open',
  ],
  retest: [
    'closed',
    'open',
  ],
  closed: [
    'open',
  ],
  deferred: [
    'open',
  ],
};

export function releaseDefectSeverityLabel(
  severity: ReleaseDefectSeverity,
): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function releaseDefectSeverityVariant(
  severity: ReleaseDefectSeverity,
): 'danger' | 'warning' | 'neutral' {
  if (
    severity === 'critical' ||
    severity === 'high'
  ) {
    return 'danger';
  }

  if (severity === 'medium') {
    return 'warning';
  }

  return 'neutral';
}

export function releaseDefectStatusLabel(
  status: ReleaseDefectStatus,
): string {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'fixed':
      return 'Fixed';
    case 'retest':
      return 'Retest';
    case 'closed':
      return 'Closed';
    case 'deferred':
      return 'Deferred';
    default:
      return 'Open';
  }
}

export function releaseDefectStatusVariant(
  status: ReleaseDefectStatus,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'closed':
      return 'success';
    case 'fixed':
    case 'retest':
      return 'info';
    case 'deferred':
      return 'warning';
    case 'open':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function releaseDefectBlocksSignoff(
  defect: Pick<ReleaseDefect, 'severity' | 'status'>,
): boolean {
  return (
    (
      defect.severity === 'critical' ||
      defect.severity === 'high'
    ) &&
    defect.status !== 'closed'
  );
}

export function allowedReleaseDefectStatuses(
  current: ReleaseDefectStatus,
): ReleaseDefectStatus[] {
  return [
    current,
    ...transitions[current],
  ];
}

export function releaseDefectNeedsResolutionNote(
  status: ReleaseDefectStatus,
): boolean {
  return (
    status === 'fixed' ||
    status === 'closed' ||
    status === 'deferred'
  );
}

export function releaseGoLiveLabel(
  status: ReleaseGoLiveStatus,
): string {
  if (status.activeSignoff) {
    return status.signoffValid
      ? 'Signed off'
      : 'Sign-off stale';
  }

  return status.eligible
    ? 'Eligible'
    : 'Blocked';
}

export function releaseGoLiveVariant(
  status: ReleaseGoLiveStatus,
): 'success' | 'warning' | 'danger' {
  if (status.activeSignoff) {
    return status.signoffValid
      ? 'success'
      : 'danger';
  }

  return status.eligible
    ? 'warning'
    : 'danger';
}
