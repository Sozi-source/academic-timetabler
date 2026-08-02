import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  UnitOffering,
} from '@/features/unit-offerings';

function createOffering(
  overrides:
    Partial<UnitOffering> = {},
): UnitOffering {
  return {
    id: 'offering-1',

    academicPeriodId:
      'period-1',
    cohortId: 'cohort-1',
    unitId: 'unit-1',

    offeringType:
      'classroom',
    status: 'draft',
    isTimetableEnabled: true,

    weeklySessions: 2,
    sessionDurationMinutes:
      120,

    deliveryNotes: null,
    source:
      'automatic_curriculum_recommendation',

    origin: 'curriculum',
    selectionState:
      'included',

    recommendedStageNumber: 2,
    exceptionReason: null,

    manuallyReviewed: false,
    reviewedBy: null,
    reviewedAt: null,

    createdBy: null,
    updatedBy: null,
    createdAt:
      '2026-08-02T00:00:00.000Z',
    updatedAt:
      '2026-08-02T00:00:00.000Z',

    academicPeriod: null,
    cohort: null,
    unit: null,

    ...overrides,
  };
}

describe(
  'Units on Offer domain',
  () => {
    it(
      'represents an expected curriculum unit',
      () => {
        const offering =
          createOffering();

        expect(
          offering.origin,
        ).toBe('curriculum');

        expect(
          offering.selectionState,
        ).toBe('included');

        expect(
          offering.recommendedStageNumber,
        ).toBe(2);
      },
    );

    it(
      'represents a manually excluded unit',
      () => {
        const offering =
          createOffering({
            selectionState:
              'excluded',
            status: 'cancelled',
            isTimetableEnabled:
              false,
            exceptionReason:
              'Unit postponed to the next Academic Period.',
            manuallyReviewed:
              true,
          });

        expect(
          offering.selectionState,
        ).toBe('excluded');

        expect(
          offering.isTimetableEnabled,
        ).toBe(false);
      },
    );

    it(
      'represents a special unit from another stage',
      () => {
        const offering =
          createOffering({
            origin: 'special',
            recommendedStageNumber: 1,
            exceptionReason:
              'Approved repeat unit.',
            manuallyReviewed:
              true,
          });

        expect(
          offering.origin,
        ).toBe('special');

        expect(
          offering.exceptionReason,
        ).toBe(
          'Approved repeat unit.',
        );
      },
    );

    it(
      'keeps attachment outside ordinary timetable generation',
      () => {
        const offering =
          createOffering({
            offeringType:
              'attachment',
            isTimetableEnabled:
              false,
          });

        expect(
          offering.offeringType,
        ).toBe('attachment');

        expect(
          offering.isTimetableEnabled,
        ).toBe(false);
      },
    );
  },
);