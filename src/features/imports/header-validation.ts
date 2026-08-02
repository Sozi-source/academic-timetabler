import {
  ImportWorkbookError,
  type ImportColumnDefinition,
} from './types';

export function normalizeImportHeader(
  value: string,
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function buildHeaderMap(
  actualHeaders: string[],
  columns: readonly ImportColumnDefinition[],
) {
  const expectedHeaders = new Map(
    columns.map((column) => [
      normalizeImportHeader(column.header),
      column,
    ]),
  );

  const headerMap =
    new Map<number, ImportColumnDefinition>();

  const duplicateHeaders: string[] = [];
  const unknownHeaders: string[] = [];
  const seenHeaders = new Set<string>();

  actualHeaders.forEach(
    (actualHeader, index) => {
      const normalized =
        normalizeImportHeader(actualHeader);

      if (!normalized) {
        return;
      }

      if (seenHeaders.has(normalized)) {
        duplicateHeaders.push(actualHeader);
        return;
      }

      seenHeaders.add(normalized);

      const column =
        expectedHeaders.get(normalized);

      if (!column) {
        unknownHeaders.push(actualHeader);
        return;
      }

      headerMap.set(index + 1, column);
    },
  );

  const missingRequiredHeaders =
    columns
      .filter(
        (column) =>
          column.required &&
          !seenHeaders.has(
            normalizeImportHeader(
              column.header,
            ),
          ),
      )
      .map((column) => column.header);

  const details: string[] = [];

  if (missingRequiredHeaders.length > 0) {
    details.push(
      `Missing required columns: ${missingRequiredHeaders.join(', ')}.`,
    );
  }

  if (duplicateHeaders.length > 0) {
    details.push(
      `Duplicate columns: ${duplicateHeaders.join(', ')}.`,
    );
  }

  if (unknownHeaders.length > 0) {
    details.push(
      `Unrecognized columns: ${unknownHeaders.join(', ')}.`,
    );
  }

  if (details.length > 0) {
    throw new ImportWorkbookError(
      'The workbook columns do not match the standardized template.',
      'INVALID_HEADERS',
      details,
    );
  }

  return headerMap;
}