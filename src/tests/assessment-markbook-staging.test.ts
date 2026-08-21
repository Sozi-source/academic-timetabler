import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildAssessmentMarkbookStagePayload,
} from '@/features/assessment/markbook-staging';

describe('assessment markbook staging', () => {
  it('normalizes validated workbook rows for database staging', () => {
    const payload =
      buildAssessmentMarkbookStagePayload({
        filename:
          'Nutrition Epidemiology.xlsx',
        sha256:
          'a'.repeat(
            64,
          ),
        validation: {
          valid:
            true,
          templateVersion:
            '1.0',
          generationId:
            '11111111-1111-4111-8111-111111111111',
          rootAssessmentId:
            '22222222-2222-4222-8222-222222222222',
          assessmentType:
            'cat',
          academicPeriodId:
            '33333333-3333-4333-8333-333333333333',
          unitId:
            '44444444-4444-4444-8444-444444444444',
          totalRows:
            3,
          numericMarks:
            1,
          absences:
            1,
          missingMarks:
            1,
          issues:
            [],
          rows: [
            {
              sheetName:
                'DHN SEPT 25',
              assessmentId:
                '55555555-5555-4555-8555-555555555555',
              cohortId:
                '66666666-6666-4666-8666-666666666666',
              studentId:
                '77777777-7777-4777-8777-777777777777',
              admissionNumber:
                'DHN001',
              workbookRow:
                8,
              attendanceStatus:
                'expected',
              mark:
                18,
              resultStatus:
                'sat',
            },
            {
              sheetName:
                'DHN SEPT 25',
              assessmentId:
                '55555555-5555-4555-8555-555555555555',
              cohortId:
                '66666666-6666-4666-8666-666666666666',
              studentId:
                '88888888-8888-4888-8888-888888888888',
              admissionNumber:
                'DHN002',
              workbookRow:
                9,
              attendanceStatus:
                'absent',
              mark:
                'AB',
              resultStatus:
                'absent',
            },
            {
              sheetName:
                'DHN SEPT 25',
              assessmentId:
                '55555555-5555-4555-8555-555555555555',
              cohortId:
                '66666666-6666-4666-8666-666666666666',
              studentId:
                '99999999-9999-4999-8999-999999999999',
              admissionNumber:
                'DHN003',
              workbookRow:
                10,
              attendanceStatus:
                'expected',
              mark:
                null,
              resultStatus:
                'missing_mark',
            },
          ],
        },
      });

    expect(
      payload.rows,
    ).toHaveLength(
      3,
    );

    expect(
      payload.rows[0]
        .mark,
    ).toBe(
      18,
    );

    expect(
      payload.rows[1]
        .mark,
    ).toBeNull();

    expect(
      payload.rows[1]
        .resultStatus,
    ).toBe(
      'absent',
    );

    expect(
      payload.validationSummary,
    ).toEqual({
      totalRows:
        3,
      numericMarks:
        1,
      absences:
        1,
      missingMarks:
        1,
    });
  });

  it('refuses an invalid workbook', () => {
    expect(() =>
      buildAssessmentMarkbookStagePayload({
        filename:
          'Invalid.xlsx',
        sha256:
          'b'.repeat(
            64,
          ),
        validation: {
          valid:
            false,
          templateVersion:
            '1.0',
          generationId:
            '11111111-1111-4111-8111-111111111111',
          rootAssessmentId:
            '22222222-2222-4222-8222-222222222222',
          assessmentType:
            'exam',
          academicPeriodId:
            '33333333-3333-4333-8333-333333333333',
          unitId:
            '44444444-4444-4444-8444-444444444444',
          totalRows:
            1,
          numericMarks:
            0,
          absences:
            0,
          missingMarks:
            1,
          issues: [
            {
              code:
                'invalid_mark',
              message:
                'Invalid mark.',
            },
          ],
          rows:
            [],
        },
      }),
    ).toThrow(
      'Only a valid assessment workbook can be staged.',
    );
  });
});
