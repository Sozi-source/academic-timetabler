import { z } from 'zod';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  markDuplicateImportRows,
  validateParsedImportRow,
  type ParsedImportRow,
} from '@/features/imports';

const schema = z.object({
  staffNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(1),
  fullName: z
    .string()
    .trim()
    .min(2),
});

function createRow(
  rowNumber: number,
  staffNumber: string,
  fullName: string,
): ParsedImportRow {
  return {
    sourceRowNumber: rowNumber,
    sourceData: {
      'Staff Number': staffNumber,
      'Full Name': fullName,
    },
    normalizedData: {
      staffNumber,
      fullName,
    },
  };
}

describe('validateParsedImportRow', () => {
  it('returns normalized valid data', () => {
    const result =
      validateParsedImportRow<z.infer<typeof schema>>({
        row: createRow(
          2,
          'tr-001',
          'Jane Waithera',
        ),
        schema,
        duplicateKey: (value) =>
          value.staffNumber,
      });

    expect(result.status).toBe('valid');

    expect(
      result.normalizedData,
    ).toEqual({
      staffNumber: 'TR-001',
      fullName: 'Jane Waithera',
    });

    expect(result.duplicateKey).toBe(
      'TR-001',
    );
  });

  it('returns field-level errors', () => {
    const result =
      validateParsedImportRow<z.infer<typeof schema>>({
        row: createRow(
          2,
          '',
          'J',
        ),
        schema,
      });

    expect(result.status).toBe(
      'invalid',
    );

    expect(
      result.fieldErrors.staffNumber,
    ).toBeDefined();

    expect(
      result.fieldErrors.fullName,
    ).toBeDefined();
  });
});

describe('markDuplicateImportRows', () => {
  it('marks duplicate workbook rows', () => {
    const results = [
      validateParsedImportRow<z.infer<typeof schema>>({
        row: createRow(
          2,
          'TR-001',
          'Jane Waithera',
        ),
        schema,
        duplicateKey: (value) =>
          value.staffNumber,
      }),
      validateParsedImportRow<z.infer<typeof schema>>({
        row: createRow(
          3,
          'TR-001',
          'John Kamau',
        ),
        schema,
        duplicateKey: (value) =>
          value.staffNumber,
      }),
    ];

    markDuplicateImportRows(results);

    expect(results[0].status).toBe(
      'duplicate',
    );

    expect(results[1].status).toBe(
      'duplicate',
    );
  });
});