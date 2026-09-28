import ExcelJS from 'exceljs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateAssessmentMarkbook,
} from '@/features/assessment/markbook-generator';
import {
  validateAssessmentMarkbook,
} from '@/features/assessment/markbook-validator';

describe('assessment markbook maximum mark validation', () => {
  it('rejects a numeric mark above the configured maximum', async () => {
    const source =
      await generateAssessmentMarkbook({
        generationId:
          '11111111-1111-4111-8111-111111111111',
        rootAssessmentId:
          '22222222-2222-4222-8222-222222222222',
        assessmentType:
          'cat',
        academicPeriod: {
          id:
            '33333333-3333-4333-8333-333333333333',
          code:
            'SEP-DEC-2026',
          name:
            'Sep-Dec 2026',
        },
        unit: {
          id:
            '44444444-4444-4444-8444-444444444444',
          code:
            'HND-101',
          name:
            'Nutrition Epidemiology',
        },
        generatedAt:
          new Date(
            '2026-08-21T12:00:00Z',
          ),
        cohorts: [
          {
            assessmentId:
              '55555555-5555-4555-8555-555555555555',
            cohortId:
              '66666666-6666-4666-8666-666666666666',
            cohortName:
              'DHN SEPT 25',
            students: [
              {
                studentId:
                  '77777777-7777-4777-8777-777777777777',
                admissionNumber:
                  'DHN001',
                fullName:
                  'Student One',
                attendanceStatus:
                  'expected',
              },
            ],
          },
        ],
      });

    const workbook =
      new ExcelJS.Workbook();

    await workbook.xlsx.load(
      source as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0],
    );

    const sheet =
      workbook.getWorksheet(
        'DHN SEPT 25',
      );

    expect(
      sheet,
    ).toBeDefined();

    if (!sheet) {
      throw new Error(
        'Expected assessment worksheet.',
      );
    }

    sheet.getCell(
      'E8',
    ).value =
      31;

    const saved =
      await workbook.xlsx.writeBuffer();

    const result =
      await validateAssessmentMarkbook(
        Buffer.from(
          saved,
        ),
        '22222222-2222-4222-8222-222222222222',
        30,
      );

    expect(
      result.valid,
    ).toBe(
      false,
    );

    expect(
      result.issues.some(
        (issue) =>
          issue.code ===
          'invalid_mark' &&
          issue.message.includes(
            'maximum',
          ),
      ),
    ).toBe(
      true,
    );
  });
});
