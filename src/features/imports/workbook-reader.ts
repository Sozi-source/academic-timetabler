import ExcelJS, {
  type CellValue,
} from 'exceljs';

import {
  IMPORT_DEFAULT_MAXIMUM_ROWS,
  IMPORT_MAXIMUM_FILE_SIZE_BYTES,
  IMPORT_METADATA_KEYS,
} from './constants';
import {
  buildHeaderMap,
} from './header-validation';
import {
  ImportWorkbookError,
  type ImportCellValue,
  type ImportEntityType,
  type ImportTemplateDefinition,
  type ImportTemplateMetadata,
  type ParsedImportRow,
  type ParsedImportWorkbook,
} from './types';

interface ReadImportWorkbookOptions {
  fileName: string;
  buffer: Buffer | ArrayBuffer;
  definition: ImportTemplateDefinition;
}

function toNodeBuffer(
  value: Buffer | ArrayBuffer,
) {
  return Buffer.isBuffer(value)
    ? value
    : Buffer.from(value);
}

function normalizeCellValue(
  value: CellValue,
): ImportCellValue {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'string'
  ) {
    return value.text;
  }

  if (
    typeof value === 'object' &&
    'richText' in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText
      .map((part) => part.text)
      .join('');
  }

  if (
    typeof value === 'object' &&
    'formula' in value
  ) {
    return normalizeCellValue(
      value.result ?? null,
    );
  }

  if (
    typeof value === 'object' &&
    'sharedFormula' in value
  ) {
    return normalizeCellValue(
      value.result ?? null,
    );
  }

  if (
    typeof value === 'object' &&
    'error' in value
  ) {
    return String(value.error);
  }

  return String(value);
}

function normalizeRowValue(
  value: ImportCellValue,
) {
  if (typeof value === 'string') {
    const normalized = value.trim();

    return normalized || null;
  }

  return value;
}

function isEmptyRow(
  values: Record<string, ImportCellValue>,
) {
  return Object.values(values).every(
    (value) =>
      value === null ||
      (typeof value === 'string' &&
        value.trim() === ''),
  );
}

function readMetadataWorksheet(
  worksheet: ExcelJS.Worksheet,
): ImportTemplateMetadata {
  const values = new Map<string, string>();

  worksheet.eachRow((row) => {
    const key = String(
      row.getCell(1).value ?? '',
    )
      .trim()
      .toLowerCase();

    const value = String(
      row.getCell(2).value ?? '',
    ).trim();

    if (key) {
      values.set(key, value);
    }
  });

  const templateKey =
    values.get(
      IMPORT_METADATA_KEYS.templateKey,
    );

  const templateVersion =
    values.get(
      IMPORT_METADATA_KEYS.templateVersion,
    );

  const entityType =
    values.get(
      IMPORT_METADATA_KEYS.entityType,
    ) as ImportEntityType | undefined;

  if (
    !templateKey ||
    !templateVersion ||
    !entityType
  ) {
    throw new ImportWorkbookError(
      'The workbook template metadata is incomplete.',
      'INVALID_TEMPLATE',
    );
  }

  return {
    templateKey,
    templateVersion,
    entityType,
  };
}

function validateTemplateMetadata(
  metadata: ImportTemplateMetadata,
  definition: ImportTemplateDefinition,
) {
  const details: string[] = [];

  if (
    metadata.templateKey !== definition.key
  ) {
    details.push(
      `Expected template "${definition.key}" but received "${metadata.templateKey}".`,
    );
  }

  if (
    metadata.entityType !==
    definition.entityType
  ) {
    details.push(
      `Expected entity "${definition.entityType}" but received "${metadata.entityType}".`,
    );
  }

  if (details.length > 0) {
    throw new ImportWorkbookError(
      'The workbook belongs to a different import template.',
      'INVALID_TEMPLATE',
      details,
    );
  }

  if (
    metadata.templateVersion !==
    definition.version
  ) {
    throw new ImportWorkbookError(
      `Template version ${metadata.templateVersion} is not supported. Download version ${definition.version}.`,
      'UNSUPPORTED_TEMPLATE_VERSION',
    );
  }
}

function readHeaders(
  worksheet: ExcelJS.Worksheet,
) {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  for (
    let columnNumber = 1;
    columnNumber <= headerRow.cellCount;
    columnNumber += 1
  ) {
    const value = normalizeCellValue(
      headerRow.getCell(columnNumber).value,
    );

    headers.push(
      value === null
        ? ''
        : String(value).trim(),
    );
  }

  return headers;
}

export async function readImportWorkbook({
  fileName,
  buffer,
  definition,
}: ReadImportWorkbookOptions): Promise<ParsedImportWorkbook> {
  const fileBuffer = toNodeBuffer(buffer);

  if (fileBuffer.byteLength === 0) {
    throw new ImportWorkbookError(
      'The uploaded workbook is empty.',
      'FILE_EMPTY',
    );
  }

  if (
    fileBuffer.byteLength >
    IMPORT_MAXIMUM_FILE_SIZE_BYTES
  ) {
    throw new ImportWorkbookError(
      'The workbook exceeds the 50 MB upload limit.',
      'FILE_TOO_LARGE',
    );
  }

  const workbook = new ExcelJS.Workbook();

  try {
    const workbookInput =
      fileBuffer as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0];

    await workbook.xlsx.load(
      workbookInput,
    );
  }
  catch {
    throw new ImportWorkbookError(
      'The uploaded file could not be read as a valid Excel workbook.',
      'INVALID_WORKBOOK',
    );
  }

  const metadataWorksheet =
    workbook.getWorksheet(
      definition.metadataWorksheetName,
    );

  if (!metadataWorksheet) {
    throw new ImportWorkbookError(
      'The workbook metadata worksheet is missing. Download a fresh template.',
      'MISSING_METADATA_SHEET',
    );
  }

  const dataWorksheet =
    workbook.getWorksheet(
      definition.dataWorksheetName,
    );

  if (!dataWorksheet) {
    throw new ImportWorkbookError(
      `The "${definition.dataWorksheetName}" worksheet is missing.`,
      'MISSING_DATA_SHEET',
    );
  }

  const metadata =
    readMetadataWorksheet(
      metadataWorksheet,
    );

  validateTemplateMetadata(
    metadata,
    definition,
  );

  const headers =
    readHeaders(dataWorksheet);

  const headerMap =
    buildHeaderMap(
      headers,
      definition.columns,
    );

  const maximumRows =
    definition.maximumRows ??
    IMPORT_DEFAULT_MAXIMUM_ROWS;

  const rows: ParsedImportRow[] = [];
  const warnings: string[] = [];

  dataWorksheet.eachRow(
    {
      includeEmpty: false,
    },
    (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const sourceData:
        Record<string, ImportCellValue> = {};

      const normalizedData:
        Record<string, ImportCellValue> = {};

      headerMap.forEach(
        (columnDefinition, columnNumber) => {
          const rawValue =
            normalizeCellValue(
              row.getCell(columnNumber).value,
            );

          sourceData[columnDefinition.header] =
            rawValue;

          normalizedData[columnDefinition.key] =
            normalizeRowValue(rawValue);
        },
      );

      if (isEmptyRow(normalizedData)) {
        return;
      }

      rows.push({
        sourceRowNumber: rowNumber,
        sourceData,
        normalizedData,
      });
    },
  );

  if (rows.length === 0) {
    throw new ImportWorkbookError(
      'The workbook does not contain any data rows.',
      'NO_DATA_ROWS',
    );
  }

  if (rows.length > maximumRows) {
    throw new ImportWorkbookError(
      `The workbook contains ${rows.length} rows. The maximum allowed is ${maximumRows}.`,
      'TOO_MANY_ROWS',
    );
  }

  if (
    dataWorksheet.actualRowCount !==
    dataWorksheet.rowCount
  ) {
    warnings.push(
      'The workbook contains formatted empty rows that were ignored.',
    );
  }

  return {
    fileName,
    fileSizeBytes: fileBuffer.byteLength,
    metadata,
    headers,
    rows,
    warnings,
  };
}