import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getCombinedCohortSize,
  getOfferingCohortIds,
  getOfferingUnitIds,
  getPrimaryOfferingParticipant,
  isSharedTeachingOffering,
  type TeachingOfferingParticipant,
} from '@/features/teaching-offerings';

function createParticipant({
  id,
  cohortId,
  unitId,
  cohortSize,
  isPrimary = false,
}: {
  id: string;
  cohortId: string;
  unitId: string;
  cohortSize: number;
  isPrimary?: boolean;
}): TeachingOfferingParticipant {
  return {
    id,
    teachingOfferingId:
      'offering-1',
    cohortId,
    unitId,
    isPrimary,
    notes: null,
    createdBy: null,
    updatedBy: null,
    createdAt:
      '2026-08-02T00:00:00.000Z',
    updatedAt:
      '2026-08-02T00:00:00.000Z',
    cohort: {
      id: cohortId,
      programmeId:
        `programme-${cohortId}`,
      code:
        cohortId.toUpperCase(),
      name:
        `Cohort ${cohortId}`,
      intakeDate:
        '2026-09-01',
      expectedCompletionDate:
        '2028-12-31',
      currentAcademicPeriodNumber:
        1,
      plannedSize:
        cohortSize,
      actualSize:
        cohortSize,
      status: 'active',
      isTimetableAvailable:
        true,
      notes: null,
      createdBy: null,
      updatedBy: null,
      createdAt:
        '2026-08-02T00:00:00.000Z',
      updatedAt:
        '2026-08-02T00:00:00.000Z',
      programme: null,
    },
  };
}

describe(
  'teaching offering calculations',
  () => {
    it(
      'returns unique participating cohorts',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'unit-1',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-2',
            unitId: 'unit-2',
            cohortSize: 30,
          }),
        ];

        expect(
          getOfferingCohortIds(
            participants,
          ),
        ).toEqual([
          'cohort-1',
          'cohort-2',
        ]);
      },
    );

    it(
      'preserves programme-specific unit identities',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'certificate-unit',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-2',
            unitId: 'diploma-unit',
            cohortSize: 30,
          }),
        ];

        expect(
          getOfferingUnitIds(
            participants,
          ),
        ).toEqual([
          'certificate-unit',
          'diploma-unit',
        ]);
      },
    );

    it(
      'calculates combined cohort size',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'unit-1',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-2',
            unitId: 'unit-2',
            cohortSize: 30,
          }),
        ];

        expect(
          getCombinedCohortSize(
            participants,
          ),
        ).toBe(50);
      },
    );

    it(
      'does not double-count the same cohort',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'unit-1',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-1',
            unitId: 'unit-2',
            cohortSize: 20,
          }),
        ];

        expect(
          getCombinedCohortSize(
            participants,
          ),
        ).toBe(20);
      },
    );

    it(
      'identifies shared offerings',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'unit-1',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-2',
            unitId: 'unit-2',
            cohortSize: 30,
          }),
        ];

        expect(
          isSharedTeachingOffering({
            participants,
          }),
        ).toBe(true);
      },
    );

    it(
      'resolves the primary participant',
      () => {
        const participants = [
          createParticipant({
            id: 'member-1',
            cohortId: 'cohort-1',
            unitId: 'unit-1',
            cohortSize: 20,
          }),
          createParticipant({
            id: 'member-2',
            cohortId: 'cohort-2',
            unitId: 'unit-2',
            cohortSize: 30,
            isPrimary: true,
          }),
        ];

        expect(
          getPrimaryOfferingParticipant(
            participants,
          )?.id,
        ).toBe('member-2');
      },
    );
  },
);