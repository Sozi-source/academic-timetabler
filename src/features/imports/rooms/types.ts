import type {
  RoomType,
} from '@/features/rooms/types';

export interface NormalizedRoomImportRow {
  code: string;
  name: string;
  roomType: RoomType;
  capacity: number;
  building?: string;
  floor?: string;
  timetableAvailable: boolean;
  notes?: string;
}

export interface RoomImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialRoomImportActionState:
RoomImportActionState = {
  status: 'idle',
  message: null,
};

export interface RoomImportBatch {
  id: string;
  entityType: 'rooms';
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

export interface RoomImportStagedRow {
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
    | NormalizedRoomImportRow
    | Record<string, never>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
  duplicateKey: string | null;
  importedRecordId: string | null;
}

export interface RoomImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}