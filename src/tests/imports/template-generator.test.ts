import ExcelJS from 'exceljs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateImportTemplate,
} from '@/features/imports/template-generator';
import {
  programmesImportTemplate,
  roomsImportTemplate,
  trainersImportTemplate,
} from '@/features/imports/templates';

describe('generateImportTemplate', () => {
  it.each([
    trainersImportTemplate,
    roomsImportTemplate,
    programmesImportTemplate,
  ])(
    'generates the $displayName template',
    async (definition) => {
      const buffer =
        await generateImportTemplate(
          definition,
        );

      expect(buffer.byteLength).toBeGreaterThan(
        1000,
      );

      const workbook =
        new ExcelJS.Workbook();

      const input =
        buffer as unknown as Parameters<
          typeof workbook.xlsx.load
        >[0];

      await workbook.xlsx.load(input);

      const instructions =
        workbook.getWorksheet(
          definition.instructionsWorksheetName,
        );

      const data =
        workbook.getWorksheet(
          definition.dataWorksheetName,
        );

      const metadata =
        workbook.getWorksheet(
          definition.metadataWorksheetName,
        );

      expect(instructions).toBeDefined();
      expect(data).toBeDefined();
      expect(metadata).toBeDefined();

      expect(metadata?.state).toBe(
        'veryHidden',
      );

      expect(
        data?.getRow(1).values,
      ).toEqual([
        undefined,
        ...definition.columns.map(
          (column) => column.header,
        ),
      ]);

      expect(
        data?.getRow(2).cellCount,
      ).toBe(
        definition.columns.length,
      );
    },
  );
});