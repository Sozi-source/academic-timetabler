export type ReleaseDefectSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ReleaseDefectStatus =
  | 'open'
  | 'in_progress'
  | 'fixed'
  | 'retest'
  | 'closed'
  | 'deferred';

export interface ReleaseDefect {
  id: string;
  defectNumber: number;
  runId: string | null;
  caseKey: string | null;
  suiteVersion: string | null;
  severity: ReleaseDefectSeverity;
  status: ReleaseDefectStatus;
  title: string;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseGoLiveStatus {
  eligible: boolean;
  signoffValid: boolean;
  blockerDefects: number;
  warningDefects: number;
  activeCatalogCaseCount: number;
  passedRunCaseCount: number;
  reasons: string[];
  latestPassedRun: {
    id: string;
    suiteVersion: string;
    completedAt: string | null;
  } | null;
  activeSignoff: {
    id: string;
    verificationRef: string;
    approvedAt: string;
  } | null;
}

export type ReleaseSignoffStatus =
  | 'approved'
  | 'revoked';

export interface ReleaseSignoff {
  id: string;
  suiteVersion: string;
  releaseTestRunId: string;
  verificationRef: string;
  status: ReleaseSignoffStatus;
  note: string | null;
  approvedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}
