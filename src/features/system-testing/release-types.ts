export type ReleaseReadinessStatus =
  | 'pass'
  | 'warning'
  | 'blocker';

export interface ReleaseReadinessCheck {
  checkKey: string;
  area: string;
  status: ReleaseReadinessStatus;
  title: string;
  detail: string;
  href: string;
}

export interface ReleaseReadinessSnapshot {
  generatedAt: string;
  ready: boolean;
  blockerCount: number;
  warningCount: number;
  checks: ReleaseReadinessCheck[];
}

export type ReleaseTestRunStatus =
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ReleaseTestOutcome =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'cancelled';

export type ReleaseTestRequirement =
  | 'critical'
  | 'required'
  | 'advisory';

export type ReleaseTestCaseResult =
  | 'pending'
  | 'pass'
  | 'fail'
  | 'blocked';

export interface ReleaseTestRun {
  id: string;
  departmentId: string;
  departmentName: string;
  academicPeriodId: string | null;
  academicPeriodName: string | null;
  suiteVersion: string;
  status: ReleaseTestRunStatus;
  outcome: ReleaseTestOutcome;
  startReadiness: ReleaseReadinessSnapshot;
  completionReadiness: ReleaseReadinessSnapshot | null;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ReleaseTestCase {
  id: string;
  runId: string;
  caseKey: string;
  area: string;
  title: string;
  expectedResult: string;
  requirementLevel: ReleaseTestRequirement;
  sequenceNumber: number;
  result: ReleaseTestCaseResult;
  note: string | null;
  testedAt: string | null;
}

export interface ReleaseTestRunWorkspace {
  run: ReleaseTestRun;
  cases: ReleaseTestCase[];
}
