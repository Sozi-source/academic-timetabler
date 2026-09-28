import type {
  DeploymentEnvironment,
  DeploymentStatus,
  ProductionIncident,
  ProductionIncidentSeverity,
  ProductionIncidentStatus,
  ReleaseDeployment,
} from './types';

const incidentTransitions: Record<
  ProductionIncidentStatus,
  readonly ProductionIncidentStatus[]
> = {
  open: [
    'investigating',
    'resolved',
  ],
  investigating: [
    'open',
    'resolved',
  ],
  resolved: [
    'open',
    'closed',
  ],
  closed: [
    'open',
  ],
};

export function deploymentEnvironmentLabel(
  environment: DeploymentEnvironment,
): string {
  return environment === 'production'
    ? 'Production'
    : 'Pilot';
}

export function deploymentStatusLabel(
  status: DeploymentStatus,
): string {
  switch (status) {
    case 'rolled_back':
      return 'Rolled back';
    case 'superseded':
      return 'Superseded';
    default:
      return 'Deployed';
  }
}

export function deploymentStatusVariant(
  status: DeploymentStatus,
): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'deployed':
      return 'success';
    case 'rolled_back':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function activeDeployment(
  deployments: ReleaseDeployment[],
  environment: DeploymentEnvironment,
): ReleaseDeployment | null {
  return deployments.find(
    (deployment) =>
      deployment.environment === environment &&
      deployment.status === 'deployed',
  ) ?? null;
}

export function incidentSeverityLabel(
  severity: ProductionIncidentSeverity,
): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function incidentSeverityVariant(
  severity: ProductionIncidentSeverity,
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

export function incidentStatusLabel(
  status: ProductionIncidentStatus,
): string {
  switch (status) {
    case 'investigating':
      return 'Investigating';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
}

export function incidentStatusVariant(
  status: ProductionIncidentStatus,
): 'danger' | 'warning' | 'info' | 'success' {
  switch (status) {
    case 'open':
      return 'danger';
    case 'investigating':
      return 'warning';
    case 'resolved':
      return 'info';
    default:
      return 'success';
  }
}

export function incidentBlocksProduction(
  incident: Pick<ProductionIncident, 'severity' | 'status'>,
): boolean {
  return (
    (
      incident.severity === 'critical' ||
      incident.severity === 'high'
    ) &&
    (
      incident.status === 'open' ||
      incident.status === 'investigating'
    )
  );
}

export function allowedIncidentStatuses(
  current: ProductionIncidentStatus,
): ProductionIncidentStatus[] {
  return [
    current,
    ...incidentTransitions[current],
  ];
}

export function incidentNeedsResolutionNote(
  status: ProductionIncidentStatus,
): boolean {
  return (
    status === 'resolved' ||
    status === 'closed'
  );
}

export function formatProductionTime(
  value: string | null,
): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(
    'en-KE',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}
