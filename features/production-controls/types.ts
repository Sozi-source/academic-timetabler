export type DeploymentEnvironment =
  | 'pilot'
  | 'production';

export type DeploymentStatus =
  | 'deployed'
  | 'superseded'
  | 'rolled_back';

export interface ReleaseDeployment {
  id: string;
  environment: DeploymentEnvironment;
  versionLabel: string;
  releaseSignoffId: string | null;
  releaseTestRunId: string;
  suiteVersion: string;
  verificationRef: string | null;
  status: DeploymentStatus;
  note: string | null;
  deployedAt: string;
  deployedByName: string | null;
  rolledBackAt: string | null;
  rollbackReason: string | null;
}

export type ProductionIncidentSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ProductionIncidentStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'closed';

export interface ProductionIncident {
  id: string;
  incidentNumber: number;
  deploymentId: string | null;
  deploymentVersionLabel: string | null;
  environment: DeploymentEnvironment;
  severity: ProductionIncidentSeverity;
  status: ProductionIncidentStatus;
  title: string;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}
