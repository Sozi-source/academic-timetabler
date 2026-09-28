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

const rootAssessmentId =
  '22222222-2222-4222-8222-222222222222';

async function buildWorkbook() {
  return generateAssessmentMarkbook({
    generationId:
      '11111111-1111-4111-8111-111111111111',
    rootAssessmentId,
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
          {
            studentId:
              '88888888-8888-4888-8888-888888888888',
            admissionNumber:
              'DHN002',
            fullName:
              'Student Two',
            attendanceStatus:
              'absent',
          },
        ],
      },
    ],
  });
}

describe('assessment markbook validator', () => {
  it('accepts numeric marks and preserves online absence as AB', async () => {
    const source =
      await buildWorkbook();

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
        'Expected DHN SEPT 25 worksheet.',
      );
    }

    sheet.getCell(
      'E8',
    ).value =
      18;

    const saved =
      await workbook.xlsx.writeBuffer();

    const result =
      await validateAssessmentMarkbook(
        Buffer.from(
          saved,
        ),
        rootAssessmentId,
      );

    expect(
      result.valid,
    ).toBe(
      true,
    );

    expect(
      result.numericMarks,
    ).toBe(
      1,
    );

    expect(
      result.absences,
    ).toBe(
      1,
    );

    expect(
      result.missingMarks,
    ).toBe(
      0,
    );
  });

  it('rejects an AB typed for a student not marked absent online', async () => {
    const source =
      await buildWorkbook();

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
        'Expected DHN SEPT 25 worksheet.',
      );
    }

    sheet.getCell(
      'E8',
    ).value =
      'AB';

    const saved =
      await workbook.xlsx.writeBuffer();

    const result =
      await validateAssessmentMarkbook(
        Buffer.from(
          saved,
        ),
        rootAssessmentId,
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
          'absence_mismatch',
      ),
    ).toBe(
      true,
    );
  });
});
