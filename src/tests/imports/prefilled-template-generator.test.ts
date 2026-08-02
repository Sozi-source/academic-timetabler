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
  unitOfferingsImportTemplate,
} from '@/features/imports/unit-offerings/template';

describe(
  'Prefilled import template generator',
  () => {
    it(
      'writes supplied Semester Offering rows without the example row',
      async () => {
        const generated =
          await generateImportTemplate(
            unitOfferingsImportTemplate,
            {
              includeExampleRow: false,
              rows: [
                {
                  academicPeriod:
                    'September\u2013December 2026',
                  programmeName:
                    'Diploma in Nutrition and Dietetics',
                  cohortName:
                    'DND September 2026',
                  unitName:
                    'Communication Skills',
                  unitCode:
                    'DND 105',
                  offeringType:
                    'classroom',
                  weeklySessions: 2,
                  sessionDurationMinutes:
                    120,
                  timetableEnabled:
                    'Yes',
                  status: 'draft',
                  sharedClassKey:
                    null,
                  preferredTrainer:
                    null,
                  preferredRoom:
                    null,
                  notes: null,
                },
              ],
            },
          );

        const workbook =
          new ExcelJS.Workbook();

        await workbook.xlsx.load(
          generated as unknown as Parameters<
            typeof workbook.xlsx.load
          >[0],
        );

        const worksheet =
          workbook.getWorksheet(
            'Units on Offer',
          );

        expect(worksheet)
          .toBeDefined();

        expect(
          worksheet?.getCell('A2')
            .value,
        ).toBe(
          'September\u2013December 2026',
        );

        expect(
          worksheet?.getCell('B2')
            .value,
        ).toBe(
          'Diploma in Nutrition and Dietetics',
        );

        expect(
          worksheet?.getCell('D2')
            .value,
        ).toBe(
          'Communication Skills',
        );

        expect(
          worksheet?.getCell('G2')
            .value,
        ).toBe(2);

        expect(
          worksheet?.getCell('A3')
            .value,
        ).toBeNull();
      },
    );

    it(
      'retains the example row for ordinary blank templates',
      async () => {
        const generated =
          await generateImportTemplate(
            unitOfferingsImportTemplate,
          );

        const workbook =
          new ExcelJS.Workbook();

        await workbook.xlsx.load(
          generated as unknown as Parameters<
            typeof workbook.xlsx.load
          >[0],
        );

        const worksheet =
          workbook.getWorksheet(
            'Units on Offer',
          );

        expect(
          worksheet?.getCell('A2')
            .value,
        ).toBe(
          'September\u2013December 2026',
        );
      },
    );
  },
);