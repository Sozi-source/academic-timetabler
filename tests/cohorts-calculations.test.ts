import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateCohortProgression,
} from '@/features/cohorts/calculations';

const periods = [
  {
    id: '1',
    name: 'January-April 2025',
    sequenceNumber: 1,
    academicYearStartsOn:
      '2025-01-01',
    startsOn: '2025-01-01',
    endsOn: '2025-04-30',
  },
  {
    id: '2',
    name: 'May-August 2025',
    sequenceNumber: 2,
    academicYearStartsOn:
      '2025-01-01',
    startsOn: '2025-05-01',
    endsOn: '2025-08-31',
  },
  {
    id: '3',
    name:
      'September-December 2025',
    sequenceNumber: 3,
    academicYearStartsOn:
      '2025-01-01',
    startsOn: '2025-09-01',
    endsOn: '2025-12-19',
  },
  {
    id: '4',
    name: 'January-April 2026',
    sequenceNumber: 1,
    academicYearStartsOn:
      '2026-01-01',
    startsOn: '2026-01-01',
    endsOn: '2026-04-30',
  },
  {
    id: '5',
    name: 'May-August 2026',
    sequenceNumber: 2,
    academicYearStartsOn:
      '2026-01-01',
    startsOn: '2026-05-01',
    endsOn: '2026-08-31',
  },
  {
    id: '6',
    name:
      'September-December 2026',
    sequenceNumber: 3,
    academicYearStartsOn:
      '2026-01-01',
    startsOn: '2026-09-01',
    endsOn: '2026-12-18',
  },
  {
    id: '7',
    name: 'January-April 2027',
    sequenceNumber: 1,
    academicYearStartsOn:
      '2027-01-01',
    startsOn: '2027-01-01',
    endsOn: '2027-04-30',
  },
];

describe(
  'calculateCohortProgression',
  () => {
    it('derives period 6 and the correct completion date', () => {
      const result =
        calculateCohortProgression({
          intakeDate:
            '2025-01-06',
          totalAcademicPeriods: 6,
          academicPeriods: periods,
          activeAcademicPeriodIds: [
            '6',
          ],
        });

      expect(result.status).toBe(
        'success',
      );

      if (
        result.status ===
        'success'
      ) {
        expect(
          result.calculation
            .progressionState,
        ).toBe('in_progress');

        expect(
          result.calculation
            .currentAcademicPeriodNumber,
        ).toBe(6);

        expect(
          result.calculation
            .expectedCompletionDate,
        ).toBe('2026-12-18');
      }
    });

    it('marks a future cohort as not started', () => {
      const result =
        calculateCohortProgression({
          intakeDate:
            '2026-09-01',
          totalAcademicPeriods: 2,
          academicPeriods: periods,
          activeAcademicPeriodIds: [
            '5',
          ],
        });

      expect(result.status).toBe(
        'success',
      );

      if (
        result.status ===
        'success'
      ) {
        expect(
          result.calculation
            .progressionState,
        ).toBe('not_started');

        expect(
          result.calculation
            .currentAcademicPeriodNumber,
        ).toBeNull();
      }
    });

    it('marks a cohort completed after its final period', () => {
      const result =
        calculateCohortProgression({
          intakeDate:
            '2025-01-06',
          totalAcademicPeriods: 6,
          academicPeriods: periods,
          activeAcademicPeriodIds: [
            '7',
          ],
        });

      expect(result.status).toBe(
        'success',
      );

      if (
        result.status ===
        'success'
      ) {
        expect(
          result.calculation
            .progressionState,
        ).toBe('completed');

        expect(
          result.calculation
            .currentAcademicPeriodNumber,
        ).toBeNull();
      }
    });

    it('rejects multiple active periods', () => {
      const result =
        calculateCohortProgression({
          intakeDate:
            '2025-01-06',
          totalAcademicPeriods: 6,
          academicPeriods: periods,
          activeAcademicPeriodIds: [
            '5',
            '6',
          ],
        });

      expect(result.status).toBe(
        'error',
      );
    });

    it('rejects a broken sequence', () => {
      const brokenPeriods =
        periods.filter(
          (period) =>
            period.id !== '2',
        );

      const result =
        calculateCohortProgression({
          intakeDate:
            '2025-01-06',
          totalAcademicPeriods: 6,
          academicPeriods:
            brokenPeriods,
          activeAcademicPeriodIds: [
            '6',
          ],
        });

      expect(result.status).toBe(
        'error',
      );
    });
  },
);