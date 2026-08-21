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
  isExpired: boolean;
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

export function getEffectiveCohortLifecycle(
  cohort: CohortLifecycleInput,
  asOf: Date | string = new Date(),
): EffectiveCohortLifecycle {
  const today = toDateOnly(asOf);

  const isExpired =
    cohort.expectedCompletionDate.length >= 10 &&
    cohort.expectedCompletionDate.slice(0, 10) < today;

  if (cohort.status === 'active' && isExpired) {
    return {
      status: 'completed',
      isTimetableAvailable: false,
      isExpired: true,
    };
  }

  if (
    cohort.status === 'completed' ||
    cohort.status === 'suspended' ||
    cohort.status === 'archived'
  ) {
    return {
      status: cohort.status,
      isTimetableAvailable: false,
      isExpired,
    };
  }

  return {
    status: cohort.status,
    isTimetableAvailable:
      cohort.isTimetableAvailable && !isExpired,
    isExpired,
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
