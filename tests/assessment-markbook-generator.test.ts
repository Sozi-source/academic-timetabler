import ExcelJS from 'exceljs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generateAssessmentMarkbook,
} from '@/features/assessment/markbook-generator';

describe('assessment markbook generator', () => {
  it('creates one visible sheet per cohort and a very hidden metadata sheet', async () => {
    const buffer =
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
          {
            assessmentId:
              '99999999-9999-4999-8999-999999999999',
            cohortId:
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            cohortName:
              'DNDT JAN 26',
            students: [
              {
                studentId:
                  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                admissionNumber:
                  'DNDT001',
                fullName:
                  'Student Three',
                attendanceStatus:
                  'expected',
              },
            ],
          },
        ],
      });

    expect(
      buffer.byteLength,
    ).toBeGreaterThan(
      1000,
    );

    const workbook =
      new ExcelJS.Workbook();

    await workbook.xlsx.load(
      buffer as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0],
    );

    expect(
      workbook.getWorksheet(
        'DHN SEPT 25',
      ),
    ).toBeDefined();

    expect(
      workbook.getWorksheet(
        'DNDT JAN 26',
      ),
    ).toBeDefined();

    const metadata =
      workbook.getWorksheet(
        '_metadata',
      );

    expect(
      metadata,
    ).toBeDefined();

    expect(
      metadata?.state,
    ).toBe(
      'veryHidden',
    );

    expect(
      metadata?.getCell(
        'B2',
      ).value,
    ).toBe(
      '1.0',
    );

    expect(
      workbook
        .getWorksheet(
          'DHN SEPT 25',
        )
        ?.getCell(
          'E9',
        ).value,
    ).toBe(
      'AB',
    );
  });
});
