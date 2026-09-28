import type {
  RoomType,
} from '@/features/rooms/types';
import type {
  UnitCategory,
} from '@/features/units/types';

export interface NormalizedUnitImportRow {
  programmeCode: string;
  programmeId?: string;
  code: string;
  name: string;
  shortName?: string;
  category: UnitCategory;
  academicPeriodNumber: number;
  theoryHours: number;
  practicalHours: number;
  weeklySessions: number;
  preferredRoomType?: RoomType;
  timetableAvailable: boolean;
  notes?: string;
}

export interface UnitImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialUnitImportActionState:
UnitImportActionState = {
  status: 'idle',
  message: null,
};

export interface UnitImportBatch {
  id: string;
  entityType: 'units';
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

export interface UnitImportStagedRow {
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
    | NormalizedUnitImportRow
    | Record<string, never>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface UnitImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}