import type { ImportBatchStatus, ImportRowStatus } from '@/features/imports/types';
import type { AdmissionNumberInference } from '@/features/students/admission-number';
import type { StudentLifecycleStatus } from '@/features/students/types';

export interface RawStudentImportRow {
  admissionNumber: string;
  fullName: string;
  programmeCode?: string;
  admissionCohortCode?: string;
  currentCohortCode?: string;
  currentCohortEffectiveDate?: string;
  lifecycleStatus: StudentLifecycleStatus;
  academicPhase: 'in_class' | 'clinical_rotation' | 'attachment' | 'deferred' | 'dropped_out' | 'awaiting_graduation' | 'graduated';
  statusEffectiveDate?: string;
  statusReason?: string;
  admissionDate?: string;
  projectedCompletionDate?: string;
  kcseIndexNumber?: string;
  nationalIdNumber?: string;
  notes?: string;
}

export interface NormalizedStudentImportRow extends RawStudentImportRow {
  programmeId: string;
  resolvedProgrammeCode: string;
  admissionCohortId: string;
  resolvedAdmissionCohortCode: string;
  currentCohortId: string;
  resolvedCurrentCohortCode: string;
  inference: AdmissionNumberInference;
  resolutionSource: {
    programme: 'explicit' | 'inferred';
    admissionCohort: 'explicit' | 'inferred';
    currentCohort: 'explicit' | 'admission_default' | 'progression_group';
  };
}

export interface StudentImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialStudentImportActionState: StudentImportActionState = { status: 'idle', message: null };

export interface StudentImportBatch {
  id: string;
  originalFileName: string;
  status: ImportBatchStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
}

export interface StudentImportStagedRow {
  id: string;
  sourceRowNumber: number;
  status: ImportRowStatus;
  normalizedData: Partial<NormalizedStudentImportRow>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  importedRecordId: string | null;
}

export interface StudentImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  remaining_count: number;
  completed: boolean;
}
