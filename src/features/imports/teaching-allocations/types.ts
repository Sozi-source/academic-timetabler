import type {
  TeachingAllocationStatus,
  TeachingDeliveryMode,
} from '@/features/teaching-allocations/types';

export interface NormalizedTeachingAllocationImportRow {
  academicPeriodCode: string;
  academicPeriodId?: string;
  cohortCode: string;
  cohortId?: string;
  unitCode: string;
  unitId?: string;
  trainerStaffNumber: string;
  trainerId?: string;
  preferredRoomCode?: string;
  preferredRoomId?: string;
  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;
  status: TeachingAllocationStatus;
  timetableEnabled: boolean;
  notes?: string;
}

export interface TeachingAllocationImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialTeachingAllocationImportActionState:
TeachingAllocationImportActionState = {
  status: 'idle',
  message: null,
};

export interface TeachingAllocationImportBatch {
  id: string;
  entityType: 'teaching_allocations';
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
  createdAt: string;
  completedAt: string | null;
}

export interface TeachingAllocationImportStagedRow {
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
  sourceData: Record<string, unknown>;
  normalizedData:
    | NormalizedTeachingAllocationImportRow
    | Record<string, never>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface TeachingAllocationImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}