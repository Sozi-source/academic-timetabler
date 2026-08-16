import type {
  ZodError,
  ZodType,
} from 'zod';

import type {
  ImportCellValue,
  ImportValidationResult,
  ParsedImportRow,
} from './types';

function flattenZodErrors(
  error: ZodError,
) {
  const fieldErrors:
    Record<string, string[]> = {};

  const rowErrors: string[] = [];

  for (const issue of error.issues) {
    const fieldName =
      issue.path.length > 0
        ? String(issue.path[0])
        : null;

    if (!fieldName) {
      rowErrors.push(issue.message);
      continue;
    }

    fieldErrors[fieldName] ??= [];
    fieldErrors[fieldName].push(
      issue.message,
    );
  }

  return {
    fieldErrors,
    rowErrors,
  };
}

export function validateParsedImportRow<
  TNormalized extends object,
>({
  row,
  schema,
  duplicateKey,
}: {
  row: ParsedImportRow;
  schema: ZodType;
  duplicateKey?: (
    normalized: TNormalized,
  ) => string;
}): ImportValidationResult<TNormalized> {
  const parsed = schema.safeParse(
    row.normalizedData,
  );

  if (!parsed.success) {
    const errors =
      flattenZodErrors(parsed.error);

    return {
      sourceRowNumber:
        row.sourceRowNumber,
      status: 'invalid',
      sourceData: row.sourceData,
      normalizedData: null,
      fieldErrors:
        errors.fieldErrors,
      rowErrors: errors.rowErrors,
      duplicateKey: null,
    };
  }

  const normalized = parsed.data as TNormalized;

  return {
    sourceRowNumber:
      row.sourceRowNumber,
    status: 'valid',
    sourceData:
      row.sourceData as Record<
        string,
        ImportCellValue
      >,
    normalizedData: normalized,
    fieldErrors: {},
    rowErrors: [],
    duplicateKey:
      duplicateKey?.(normalized) ??
      null,
  };
}

export function markDuplicateImportRows<
  TNormalized extends object,
>(
  results: ImportValidationResult<TNormalized>[],
) {
  const keys = new Map<string, number[]>();

  for (
    let index = 0;
    index < results.length;
    index += 1
  ) {
    const result = results[index];

    if (
      result.status !== 'valid' ||
      !result.duplicateKey
    ) {
      continue;
    }

    const existing =
      keys.get(result.duplicateKey) ?? [];

    existing.push(index);
    keys.set(result.duplicateKey, existing);
  }

  for (const indexes of keys.values()) {
    if (indexes.length < 2) {
      continue;
    }

    for (const index of indexes) {
      const result = results[index];

      result.status = 'duplicate';
      result.rowErrors.push(
        'This row is duplicated within the uploaded workbook.',
      );
    }
  }

  return results;
}
