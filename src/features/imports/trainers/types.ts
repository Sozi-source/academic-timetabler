import type {
  TrainerAvailabilityMode,
  TrainerEmploymentType,
  TrainerWorkloadRole,
} from '@/features/trainers/types';

export interface NormalizedTrainerImportRow {
  staffNumber: string;
  fullName: string;
  departmentCode: string;
  email?: string;
  phoneNumber?: string;
  employmentType: TrainerEmploymentType;
  workloadRole: TrainerWorkloadRole;
  specialization?: string;
  qualifications?: string;
  normalWeeklyHours: number;
  maximumWeeklyHours: number;
  maximumDailyHours: number;
  availabilityMode: TrainerAvailabilityMode;
  timetableAvailable: boolean;
  notes?: string;
}

export interface TrainerImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialTrainerImportActionState:
TrainerImportActionState = {
  status: 'idle',
  message: null,
};

export interface TrainerImportBatch {
  id: string;
  entityType: 'trainers';
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

export interface TrainerImportStagedRow {
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
    | NormalizedTrainerImportRow
    | Record<string, never>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface TrainerImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}
