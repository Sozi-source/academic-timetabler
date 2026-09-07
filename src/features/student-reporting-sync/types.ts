export type ReportingSyncSourceType = 'google_sheet' | 'file' | 'paste';

export interface RawReportingRow {
  admissionNumber: string;
  reportedOn?: string | null;
  notes?: string | null;
  sourceRowNumber?: number;
}

export type ReportingMatchState = 'ready' | 'already_reported' | 'unmatched';

export interface ReconciledReportingItem {
  id: string; // unique key for UI rendering
  studentId?: string;
  admissionNumber: string;
  studentName?: string;
  cohortName?: string;
  programmeCode?: string;
  currentLifecycleStatus?: string;
  reportedOn: string;
  matchState: ReportingMatchState;
  matchReason?: string;
}

export interface ReportingSyncSummary {
  totalRows: number;
  readyCount: number;
  alreadyReportedCount: number;
  unmatchedCount: number;
}

export interface ReportingSyncPreviewResult {
  success: boolean;
  academicPeriod: {
    id: string;
    code: string;
    name: string;
  } | null;
  summary: ReportingSyncSummary;
  items: ReconciledReportingItem[];
  error?: string;
}

export interface ReportingSyncCommitResult {
  success: boolean;
  activatedCount: number;
  alreadyActiveCount: number;
  message: string;
  error?: string;
}
