import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  applyAutomaticSharedClassKeys,
  normalizeUnitNameForSharing,
} from '@/features/imports/unit-offerings/shared-class-detection';
import type {
  NormalizedUnitOfferingImportRow,
} from '@/features/imports/unit-offerings/types';

function createRow(
  overrides:
    Partial<NormalizedUnitOfferingImportRow> = {},
): {
  status: string;
  normalizedData:
    NormalizedUnitOfferingImportRow;
} {
  return {
    status: 'valid',
    normalizedData: {
      academicPeriod:
        'September-December 2026',
      academicPeriodId: 'period-1',
      programmeName: 'Programme',
      cohortName: 'Cohort',
      cohortId: crypto.randomUUID(),
      unitName: 'Communication Skills',
      offeringType: 'classroom',
      weeklySessions: 1,
      sessionDurationMinutes: 120,
      timetableEnabled: true,
      status: 'draft',
      ...overrides,
    },
  };
}

describe(
  'automatic shared-class detection',
  () => {
    it(
      'normalizes common naming differences',
      () => {
        expect(
          normalizeUnitNameForSharing(
            'Nutrition in the Lifecycle',
          ),
        ).toBe(
          'nutrition in the lifespan',
        );

        expect(
          normalizeUnitNameForSharing(
            'HIV/AIDS Management',
          ),
        ).toBe(
          'hiv and aids management',
        );
      },
    );

    it(
      'combines equivalent units across cohorts',
      () => {
        const rows = [
          createRow({
            cohortId: 'cohort-1',
            unitName:
              'Nutrition in the Lifecycle',
          }),
          createRow({
            cohortId: 'cohort-2',
            unitName:
              'Nutrition in the lifespan',
          }),
        ];

        applyAutomaticSharedClassKeys(
          rows,
        );

        expect(
          rows[0].normalizedData
            ?.sharedClassKey,
        ).toBeTruthy();

        expect(
          rows[0].normalizedData
            ?.sharedClassKey,
        ).toBe(
          rows[1].normalizedData
            ?.sharedClassKey,
        );

        expect(
          rows[0].normalizedData
            ?.sharedClassSource,
        ).toBe('automatic');
      },
    );

    it(
      'does not combine rows with different session requirements',
      () => {
        const rows = [
          createRow({
            cohortId: 'cohort-1',
            weeklySessions: 1,
          }),
          createRow({
            cohortId: 'cohort-2',
            weeklySessions: 2,
          }),
        ];

        applyAutomaticSharedClassKeys(
          rows,
        );

        expect(
          rows[0].normalizedData
            ?.sharedClassKey,
        ).toBeUndefined();

        expect(
          rows[1].normalizedData
            ?.sharedClassKey,
        ).toBeUndefined();
      },
    );

    it(
      'honours INDEPENDENT as a split override',
      () => {
        const rows = [
          createRow({
            cohortId: 'cohort-1',
            sharedClassKey:
              'INDEPENDENT',
          }),
          createRow({
            cohortId: 'cohort-2',
          }),
        ];

        applyAutomaticSharedClassKeys(
          rows,
        );

        expect(
          rows[0].normalizedData
            ?.sharedClassKey,
        ).toBeUndefined();

        expect(
          rows[0].normalizedData
            ?.sharedClassSource,
        ).toBe('independent');
      },
    );
  },
);
