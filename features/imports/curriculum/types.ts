export type CurriculumResolution =
  | 'match_existing'
  | 'normalize_existing'
  | 'create_new';

export interface NormalizedCurriculumImportRow {
  programmeCode: string;
  programmeId?: string;
  stage: string;
  stageNumber?: number;
  code: string;
  name: string;
  unitId?: string;
  resolution?: CurriculumResolution;
}

export interface CurriculumImportActionState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

export const initialCurriculumImportActionState: CurriculumImportActionState = {
  status: 'idle',
  message: null,
};

export interface CurriculumImportBatch {
  id: string;
  templateVersion: string;
  originalFileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  failureMessage: string | null;
}

export interface CurriculumImportStagedRow {
  id: string;
  sourceRowNumber: number;
  status: string;
  normalizedData: NormalizedCurriculumImportRow | Record<string, never>;
  fieldErrors: Record<string, string[]>;
  rowErrors: string[];
}

export interface CurriculumImportRpcResult {
  batch_id: string;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
}
