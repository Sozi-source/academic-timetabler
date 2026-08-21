import { describe, expect, it } from 'vitest';

import {
  getEffectiveCohortLifecycle,
  isOperationallyActiveCohort,
} from '@/features/cohorts/lifecycle';

describe('cohort lifecycle', () => {
  const today = '2026-08-21';

  it('keeps a current active cohort active', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'active',
        intakeDate: '2025-09-01',
        expectedCompletionDate: '2027-08-31',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('active');
    expect(result.isTimetableAvailable).toBe(true);
    expect(result.isExpired).toBe(false);
  });

  it('treats an expired active cohort as completed', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'active',
        intakeDate: '2022-09-01',
        expectedCompletionDate: '2025-08-31',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('completed');
    expect(result.isTimetableAvailable).toBe(false);
    expect(result.isExpired).toBe(true);
  });

  it('never exposes completed cohorts for timetabling', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'completed',
        intakeDate: '2023-01-01',
        expectedCompletionDate: '2026-12-31',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('completed');
    expect(result.isTimetableAvailable).toBe(false);
  });

  it('preserves suspended as an explicit state', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'suspended',
        intakeDate: '2025-01-01',
        expectedCompletionDate: '2027-12-31',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('suspended');
    expect(result.isTimetableAvailable).toBe(false);
  });

  it('reports only current timetable cohorts as operational', () => {
    expect(
      isOperationallyActiveCohort(
        {
          status: 'active',
          intakeDate: '2025-01-01',
          expectedCompletionDate: '2027-12-31',
          isTimetableAvailable: true,
        },
        today,
      ),
    ).toBe(true);

    expect(
      isOperationallyActiveCohort(
        {
          status: 'active',
          intakeDate: '2022-01-01',
          expectedCompletionDate: '2025-12-31',
          isTimetableAvailable: true,
        },
        today,
      ),
    ).toBe(false);
  });
});
