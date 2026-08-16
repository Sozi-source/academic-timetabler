import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  parseGeneratorRequest,
} from '@/features/timetable-generator/request-validation';

describe(
  'parseGeneratorRequest',
  () => {
    it(
      'accepts a valid Academic Period',
      () => {
        const formData =
          new FormData();

        formData.set(
          'academicPeriodId',
          'period-1',
        );

        const result =
          parseGeneratorRequest(
            formData,
          );

        expect(result.success).toBe(
          true,
        );

        if (!result.success) {
          return;
        }

        expect(result.data).toEqual({
          academicPeriodId:
            'period-1',
          overwriteExisting:
            false,
        });
      },
    );

    it(
      'parses the overwrite checkbox',
      () => {
        const formData =
          new FormData();

        formData.set(
          'academicPeriodId',
          'period-1',
        );

        formData.set(
          'overwriteExisting',
          'on',
        );

        const result =
          parseGeneratorRequest(
            formData,
          );

        expect(result.success).toBe(
          true,
        );

        if (!result.success) {
          return;
        }

        expect(
          result.data
            .overwriteExisting,
        ).toBe(true);
      },
    );

    it(
      'rejects a missing Academic Period',
      () => {
        const result =
          parseGeneratorRequest(
            new FormData(),
          );

        expect(result.success).toBe(
          false,
        );

        if (!('fieldErrors' in result)) {
          throw new Error('Expected generator validation to fail.');
        }

        expect(
          result.fieldErrors
            .academicPeriodId,
        ).toContain(
          'Select an Academic Period before generating a timetable.',
        );
      },
    );

    it(
      'trims the Academic Period identifier',
      () => {
        const formData =
          new FormData();

        formData.set(
          'academicPeriodId',
          '  period-1  ',
        );

        const result =
          parseGeneratorRequest(
            formData,
          );

        expect(result.success).toBe(
          true,
        );

        if (!result.success) {
          return;
        }

        expect(
          result.data
            .academicPeriodId,
        ).toBe('period-1');
      },
    );
  },
);