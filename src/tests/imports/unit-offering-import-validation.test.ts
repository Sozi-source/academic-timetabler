import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  unitOfferingImportRowSchema,
} from '@/features/imports/unit-offerings';

const validRow = {
  academicPeriod:
    'September–December 2026',
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
  sessionDurationMinutes: 120,
  timetableEnabled: 'Yes',
  status: 'draft',
  sharedClassKey:
    'communication sep26',
  preferredTrainer:
    'Jane Waithera',
  preferredRoom:
    'Lecture Room 2',
  notes:
    'Shared delivery.',
};

describe(
  'Unit Offering import validation',
  () => {
    it(
      'accepts a valid semester offering',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse(
            validRow,
          );

        expect(result.success)
          .toBe(true);

        if (!result.success) {
          return;
        }

        expect(
          result.data.sharedClassKey,
        ).toBe(
          'COMMUNICATION-SEP26',
        );

        expect(
          result.data.timetableEnabled,
        ).toBe(true);
      },
    );

    it(
      'allows different programme-specific unit codes',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse({
            ...validRow,
            unitCode: 'CND 101',
            programmeName:
              'Certificate in Nutrition and Dietetics',
            cohortName:
              'CND September 2026',
          });

        expect(result.success)
          .toBe(true);
      },
    );

    it(
      'rejects durations outside 15-minute increments',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse({
            ...validRow,
            sessionDurationMinutes:
              110,
          });

        expect(result.success)
          .toBe(false);
      },
    );

    it(
      'rejects timetable-enabled attachment rows',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse({
            ...validRow,
            offeringType:
              'attachment',
            timetableEnabled:
              'Yes',
          });

        expect(result.success)
          .toBe(false);
      },
    );

    it(
      'accepts attachment outside the classroom timetable',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse({
            ...validRow,
            offeringType:
              'attachment',
            timetableEnabled:
              'No',
            sharedClassKey: '',
          });

        expect(result.success)
          .toBe(true);
      },
    );

    it(
      'rejects a shared key on a non-schedulable row',
      () => {
        const result =
          unitOfferingImportRowSchema.safeParse({
            ...validRow,
            timetableEnabled:
              'No',
          });

        expect(result.success)
          .toBe(false);
      },
    );
  },
);