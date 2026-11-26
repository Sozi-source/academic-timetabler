import { describe, expect, it } from 'vitest';

import {
  computeCohortStageForPeriod,
  isTimetableConfigurablePeriod,
  prioritizeActiveAcademicPeriods,
  resolveAcademicPeriodId,
} from '@/features/academic-periods/selection';

const periods = [
  { id: 'period-2029', status: 'planned', code: 'SEP-DEC-29' },
  { id: 'period-2026', status: 'active', code: 'SEP-DEC-26' },
  { id: 'period-2027', status: 'planned', code: 'SEP-DEC-27' },
];

describe('Academic Period selection', () => {
  it('places the active period first without losing future periods', () => {
    expect(
      prioritizeActiveAcademicPeriods(periods).map((period) => period.id),
    ).toEqual(['period-2026', 'period-2029', 'period-2027']);
  });

  it('uses the active period when no valid period was requested', () => {
    expect(resolveAcademicPeriodId(periods)).toBe('period-2026');
    expect(resolveAcademicPeriodId(periods, 'not-a-period')).toBe('period-2026');
  });

  it('keeps an explicitly selected planned period', () => {
    expect(resolveAcademicPeriodId(periods, 'period-2029')).toBe('period-2029');
  });

  it('allows cross-year planned periods while excluding closed or archived periods', () => {
    expect(
      isTimetableConfigurablePeriod({
        id: 'p-planned',
        status: 'planned',
        academicYear: { status: 'planned' },
      }),
    ).toBe(true);

    expect(
      isTimetableConfigurablePeriod({
        id: 'p-closed',
        status: 'closed',
        academicYear: { status: 'active' },
      }),
    ).toBe(false);

    expect(
      isTimetableConfigurablePeriod({
        id: 'p-archived',
        status: 'planned',
        academicYear: { status: 'archived' },
      }),
    ).toBe(false);
  });

  it('computes future-period cohort stage from intake start and target period start without advancing prematurely', () => {
    expect(
      computeCohortStageForPeriod({
        intakeDate: '2026-09-01',
        periodStartsOn: '2027-01-04',
        totalAcademicPeriods: 6,
      }),
    ).toBe(2);

    expect(
      computeCohortStageForPeriod({
        intakeDate: '2025-01-06',
        periodStartsOn: '2027-01-04',
        totalAcademicPeriods: 6,
      }),
    ).toBeNull();
  });
});
