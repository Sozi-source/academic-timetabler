import ExcelJS from 'exceljs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ImportWorkbookError,
  type ImportTemplateDefinition,
} from '@/features/imports';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';

const trainerDefinition:
ImportTemplateDefinition = {
  key: 'hnd-trainers',
  entityType: 'trainers',
  version: '1.0',
  displayName: 'Trainers',
  instructionsWorksheetName:
    'Instructions',
  dataWorksheetName: 'Data',
  metadataWorksheetName: '_meta',
  maximumRows: 100,
  columns: [
    {
      key: 'staffNumber',
      header: 'Staff Number',
      required: true,
    },
    {
      key: 'fullName',
      header: 'Full Name',
      required: true,
    },
    {
      key: 'email',
      header: 'Email',
      required: false,
    },
  ],
};

async function createWorkbookBuffer({
  version = '1.0',
  includeMetadata = true,
  headers = [
    'Staff Number',
    'Full Name',
    'Email',
  ],
  rows = [
    [
      'TR-001',
      'Jane Waithera',
      'jane@example.com',
    ],
  ],
}: {
  version?: string;
  includeMetadata?: boolean;
  headers?: string[];
  rows?: Array<
    Array<string | number | null>
  >;
} = {}) {
  const workbook =
    new ExcelJS.Workbook();

  if (includeMetadata) {
    const metadata =
      workbook.addWorksheet('_meta');

    metadata.addRows([
      ['template_key', 'hnd-trainers'],
      ['template_version', version],
      ['entity_type', 'trainers'],
    ]);

    metadata.state = 'veryHidden';
  }

  workbook.addWorksheet('Instructions');

  const data =
    workbook.addWorksheet('Data');

  data.addRow(headers);

  for (const row of rows) {
    data.addRow(row);
  }

  return Buffer.from(
    await workbook.xlsx.writeBuffer(),
  );
}

describe('readImportWorkbook', () => {
  it('reads a valid standardized workbook', async () => {
    const buffer =
      await createWorkbookBuffer();

    const result =
      await readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer,
        definition:
          trainerDefinition,
      });

    expect(result.metadata).toEqual({
      templateKey: 'hnd-trainers',
      templateVersion: '1.0',
      entityType: 'trainers',
    });

    expect(result.rows).toHaveLength(1);

    expect(
      result.rows[0].sourceRowNumber,
    ).toBe(2);

    expect(
      result.rows[0].normalizedData,
    ).toEqual({
      staffNumber: 'TR-001',
      fullName: 'Jane Waithera',
      email: 'jane@example.com',
    });
  });

  it('ignores fully empty rows', async () => {
    const buffer =
      await createWorkbookBuffer({
        rows: [
          [
            'TR-001',
            'Jane Waithera',
            null,
          ],
          [null, null, null],
        ],
      });

    const result =
      await readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer,
        definition:
          trainerDefinition,
      });

    expect(result.rows).toHaveLength(1);
  });

  it('rejects a missing metadata worksheet', async () => {
    const buffer =
      await createWorkbookBuffer({
        includeMetadata: false,
      });

    await expect(
      readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer,
        definition:
          trainerDefinition,
      }),
    ).rejects.toMatchObject({
      code: 'MISSING_METADATA_SHEET',
    });
  });

  it('rejects an unsupported template version', async () => {
    const buffer =
      await createWorkbookBuffer({
        version: '0.9',
      });

    await expect(
      readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer,
        definition:
          trainerDefinition,
      }),
    ).rejects.toMatchObject({
      code:
        'UNSUPPORTED_TEMPLATE_VERSION',
    });
  });

  it('rejects missing required headers', async () => {
    const buffer =
      await createWorkbookBuffer({
        headers: [
          'Staff Number',
          'Email',
        ],
      });

    await expect(
      readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer,
        definition:
          trainerDefinition,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_HEADERS',
    });
  });

  it('rejects an empty workbook buffer', async () => {
    await expect(
      readImportWorkbook({
        fileName: 'trainers.xlsx',
        buffer: Buffer.alloc(0),
        definition:
          trainerDefinition,
      }),
    ).rejects.toBeInstanceOf(
      ImportWorkbookError,
    );
  });
});