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

  const missingHeaders = columns
    .filter(
      (column) =>
        !seenHeaders.has(
          normalizeImportHeader(
            column.header,
          ),
        ),
    )
    .map((column) => column.header);

  const normalizedActualHeaders =
    actualHeaders.map(normalizeImportHeader);

  const normalizedExpectedHeaders =
    columns.map((column) =>
      normalizeImportHeader(column.header),
    );

  const headersOutOfOrder =
    missingHeaders.length === 0 &&
    unknownHeaders.length === 0 &&
    duplicateHeaders.length === 0 &&
    (normalizedActualHeaders.length !==
      normalizedExpectedHeaders.length ||
      normalizedExpectedHeaders.some(
        (header, index) =>
          normalizedActualHeaders[index] !==
          header,
      ));

  const details: string[] = [];

  if (missingHeaders.length > 0) {
    details.push(
      `Missing fixed columns: ${missingHeaders.join(', ')}.`,
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

  if (headersOutOfOrder) {
    details.push(
      'Keep every column in the original template order. Optional columns may be blank but must not be deleted or moved.',
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
