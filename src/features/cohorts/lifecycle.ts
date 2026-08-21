import type { CohortStatus } from './types';

export interface CohortLifecycleInput {
  status: CohortStatus;
  intakeDate: string;
  expectedCompletionDate: string;
  isTimetableAvailable: boolean;
}

export interface EffectiveCohortLifecycle {
  status: CohortStatus;
  isTimetableAvailable: boolean;
  isPastExpectedCompletion: boolean;
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

/**
 * Expected completion is advisory only.
 * Cohort lifecycle is controlled by academic progression/status.
 */
export function getEffectiveCohortLifecycle(
  cohort: CohortLifecycleInput,
  asOf: Date | string = new Date(),
): EffectiveCohortLifecycle {
  const today = toDateOnly(asOf);

  const isPastExpectedCompletion =
    cohort.expectedCompletionDate.length >= 10 &&
    cohort.expectedCompletionDate.slice(0, 10) < today;

  if (
    cohort.status === 'completed' ||
    cohort.status === 'suspended' ||
    cohort.status === 'archived'
  ) {
    return {
      status: cohort.status,
      isTimetableAvailable: false,
      isPastExpectedCompletion,
    };
  }

  return {
    status: cohort.status,
    isTimetableAvailable: cohort.isTimetableAvailable,
    isPastExpectedCompletion,
  };
}

export function isOperationallyActiveCohort(
  cohort: CohortLifecycleInput,
  asOf: Date | string = new Date(),
): boolean {
  const lifecycle = getEffectiveCohortLifecycle(cohort, asOf);

  return (
    lifecycle.status === 'active' &&
    lifecycle.isTimetableAvailable
  );
}
