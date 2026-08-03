import type {
  UnitOfferingStatus,
  UnitOfferingType,
} from '@/features/unit-offerings/types';

export interface NormalizedUnitOfferingImportRow {
  academicPeriod: string;
  academicPeriodId?: string;

  programmeName: string;
  programmeId?: string;

  cohortName: string;
  cohortId?: string;

  unitName: string;
  unitCode?: string;
  unitId?: string;

  offeringType: UnitOfferingType;
  weeklySessions: number;
  sessionDurationMinutes: number;

  timetableEnabled: boolean;
  status: UnitOfferingStatus;

  sharedClassKey?: string;

  sharedClassSource?:
    | 'automatic'
    | 'manual'
    | 'independent'
    | 'none';

  sharedClassMatchName?: string;

  preferredTrainer?: string;
  preferredTrainerId?: string;

  preferredRoom?: string;
  preferredRoomId?: string;

  notes?: string;

  existingUnitOfferingId?: string;
  manuallyReviewed?: boolean;

  matchStrategy?:
    | 'exact-name'
    | 'name-and-code'
    | 'code-disambiguation';

  importOperation?:
    | 'insert'
    | 'update'
    | 'preserve-reviewed';
}

export interface UnitOfferingImportActionState {
  status:
    | 'idle'
    | 'error'
    | 'success';

  message: string | null;
  details?: string[];

  batchId?: string;

  importedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  sharedOfferingCount?: number;
}

export const initialUnitOfferingImportActionState:
UnitOfferingImportActionState = {
  status: 'idle',
  message: null,
};

export interface UnitOfferingImportBatch {
  id: string;
  entityType: 'unit_offerings';
  templateVersion: string;
  originalFileName: string;
  fileSizeBytes: number | null;

  status:
    | 'uploaded'
    | 'validating'
    | 'validated'
    | 'importing'
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'cancelled';

  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;

  failureMessage: string | null;

  importOptions:
    Record<string, unknown>;

  validationSummary:
    Record<string, unknown>;

  createdAt: string;
  completedAt: string | null;
}

export interface UnitOfferingImportStagedRow {
  id: string;
  sourceRowNumber: number;

  status:
    | 'pending'
    | 'valid'
    | 'invalid'
    | 'duplicate'
    | 'imported'
    | 'skipped'
    | 'failed';

  sourceData:
    Record<string, unknown>;

  normalizedData:
    | NormalizedUnitOfferingImportRow
    | Record<string, never>;

  fieldErrors:
    Record<string, string[]>;

  rowErrors: string[];

  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface UnitOfferingImportRpcResult {
  batch_id: string;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  shared_offering_count: number;
}