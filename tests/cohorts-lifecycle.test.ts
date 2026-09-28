import { describe, expect, it } from 'vitest';

import {
  getEffectiveCohortLifecycle,
  isOperationallyActiveCohort,
} from '@/features/cohorts/lifecycle';

describe('cohort lifecycle', () => {
  const today = '2026-08-21';

  it('does not complete an active cohort from projected date alone', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'active',
        intakeDate: '2025-03-01',
        expectedCompletionDate: '2026-01-01',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('active');
    expect(result.isTimetableAvailable).toBe(true);
    expect(result.isPastExpectedCompletion).toBe(true);
  });

  it('keeps completed cohorts unavailable', () => {
    const result = getEffectiveCohortLifecycle(
      {
        status: 'completed',
        intakeDate: '2022-01-01',
        expectedCompletionDate: '2025-12-31',
        isTimetableAvailable: true,
      },
      today,
    );

    expect(result.status).toBe('completed');
    expect(result.isTimetableAvailable).toBe(false);
  });

  it('allows a delayed active cohort to remain operational', () => {
    expect(
      isOperationallyActiveCohort(
        {
          status: 'active',
          intakeDate: '2025-03-01',
          expectedCompletionDate: '2026-01-01',
          isTimetableAvailable: true,
        },
        today,
      ),
    ).toBe(true);
  });
});
