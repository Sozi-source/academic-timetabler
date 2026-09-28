import type {
  ImportBatchStatus,
  ImportEntityType,
  ImportRowStatus,
} from '@/features/imports/types';

export type MasterDataImportEntity =
  | 'programmes'
  | 'cohorts';

export interface NormalizedProgrammeImportRow {
  code: string;
  name: string;
  shortName?: string;
  awardLevel: string;
  awardingBody?: string;
  durationValue: number;
  durationUnit: string;
  totalAcademicPeriods: number;
  maximumCohortSize?: number;
  timetableAvailable: boolean;
  notes?: string;
}

export interface NormalizedCohortImportRow {
  programmeCode: string;
  code: string;
  name: string;
  intakeDate: string;
  actualSize: number;
  status: string;
  notes?: string;
}

export interface MasterDataImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialMasterDataImportActionState:
MasterDataImportActionState = {
  status: 'idle',
  message: null,
};

export interface MasterDataImportBatch {
  id: string;
  entityType: ImportEntityType;
  templateVersion: string;
  originalFileName: string;
  fileSizeBytes: number | null;
  status: ImportBatchStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  failureMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MasterDataImportStagedRow {
  id: string;
  sourceRowNumber: number;
  status: ImportRowStatus;
  sourceData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface MasterDataImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}
