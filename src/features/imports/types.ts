export type ImportEntityType =
  | 'trainers'
  | 'rooms'
  | 'programmes'
  | 'cohorts'
  | 'units'
  | 'teaching_allocations'
  | 'unit_offerings';

export type ImportBatchStatus =
  | 'uploaded'
  | 'validating'
  | 'validated'
  | 'importing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type ImportRowStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'imported'
  | 'skipped'
  | 'failed';

export type ImportCellValue =
  | string
  | number
  | boolean
  | null;

export interface ImportColumnDefinition {
  /**
   * Internal normalized field name used by the application.
   */
  key: string;

  /**
   * Exact column heading displayed in the Excel template.
   */
  header: string;

  required: boolean;

  description?: string;

  example?: ImportCellValue;

  acceptedValues?: readonly string[];

  width?: number;

  numberFormat?: string;

  cellType?:
    | 'text'
    | 'number'
    | 'integer'
    | 'date'
    | 'boolean'
    | 'enum';
}

export interface ImportTemplateDefinition {
  key: string;

  entityType: ImportEntityType;

  version: string;

  displayName: string;

  dataWorksheetName: string;

  instructionsWorksheetName: string;

  metadataWorksheetName: string;

  instructions?: readonly string[];

  columns: readonly ImportColumnDefinition[];

  maximumRows?: number;
}

export interface ImportTemplateMetadata {
  templateKey: string;

  templateVersion: string;

  entityType: ImportEntityType;
}

export interface ParsedImportRow {
  sourceRowNumber: number;

  sourceData: Record<
    string,
    ImportCellValue
  >;

  normalizedData: Record<
    string,
    ImportCellValue
  >;
}

export interface ParsedImportWorkbook {
  fileName: string;

  fileSizeBytes: number;

  metadata: ImportTemplateMetadata;

  headers: string[];

  rows: ParsedImportRow[];

  warnings: string[];
}

export interface ImportFieldError {
  field: string;

  message: string;
}

export interface ImportValidationResult<
  TNormalized extends object =
    Record<string, unknown>,
> {
  sourceRowNumber: number;

  status: Extract<
    ImportRowStatus,
    'valid' | 'invalid' | 'duplicate'
  >;

  sourceData: Record<
    string,
    ImportCellValue
  >;

  normalizedData: TNormalized | null;

  fieldErrors: Record<
    string,
    string[]
  >;

  rowErrors: string[];

  duplicateKey: string | null;
}

export interface ImportBatchSummary {
  id: string;

  entityType: ImportEntityType;

  templateVersion: string;

  originalFileName: string;

  status: ImportBatchStatus;

  totalRows: number;

  validRows: number;

  invalidRows: number;

  duplicateRows: number;

  importedRows: number;

  skippedRows: number;

  failedRows: number;

  createdAt: string;

  completedAt: string | null;
}

export class ImportWorkbookError extends Error {
  constructor(
    message: string,

    public readonly code:
      | 'FILE_EMPTY'
      | 'FILE_TOO_LARGE'
      | 'INVALID_FILE_TYPE'
      | 'INVALID_WORKBOOK'
      | 'MISSING_METADATA_SHEET'
      | 'MISSING_DATA_SHEET'
      | 'INVALID_TEMPLATE'
      | 'UNSUPPORTED_TEMPLATE_VERSION'
      | 'INVALID_HEADERS'
      | 'TOO_MANY_ROWS'
      | 'NO_DATA_ROWS',

    public readonly details: string[] = [],
  ) {
    super(message);

    this.name = 'ImportWorkbookError';
  }
}