import { describe, expect, it } from 'vitest';

import { allocationMatchesOffering } from '@/features/teaching-allocations/allocation-reconciliation';

const offering = {
  teachingOfferingId: 'offering-2026',
  participants: [
    { cohortId: 'cnd-2026', unitId: 'cnd-communication' },
    { cohortId: 'dnd-2026', unitId: 'dnd-communication' },
  ],
  title: 'Communication Skills',
  sessionDurationMinutes: 120,
};

describe('allocation reconciliation', () => {
  it('matches an allocation linked directly to the teaching offering', () => {
    expect(allocationMatchesOffering(offering, {
      teachingOfferingId: 'offering-2026',
      cohortId: 'other-cohort',
      unitId: 'other-unit',
      participantCohortIds: [],
      unitTitle: null,
      sessionDurationMinutes: 120,
    })).toBe(true);
  });

  it('matches the exact cohort and curriculum unit', () => {
    expect(allocationMatchesOffering(offering, {
      teachingOfferingId: null,
      cohortId: 'cnd-2026',
      unitId: 'cnd-communication',
      participantCohortIds: ['cnd-2026'],
      unitTitle: 'Communication Skills',
      sessionDurationMinutes: 120,
    })).toBe(true);
  });

  it('does not override a different explicit shared-offering identity', () => {
    expect(allocationMatchesOffering(offering, {
      teachingOfferingId: 'old-2029-offering',
      cohortId: 'cnd-2026',
      unitId: 'old-representative-unit',
      participantCohortIds: ['cnd-2026', 'dnd-2026'],
      unitTitle: 'Communication Skills',
      sessionDurationMinutes: 120,
    })).toBe(false);
  });

  it('matches the exact source unit offering before considering titles', () => {
    expect(allocationMatchesOffering({
      ...offering,
      teachingOfferingId: null,
      participants: [{
        cohortId: 'cnd-2026',
        unitId: 'cnd-communication',
        unitOfferingId: 'unit-offering-1',
      }],
    }, {
      teachingOfferingId: null,
      sourceUnitOfferingId: 'unit-offering-1',
      cohortId: 'other-cohort',
      unitId: 'other-unit',
      participantCohortIds: [],
      unitTitle: 'Different title',
      sessionDurationMinutes: 120,
    })).toBe(true);
  });

  it('does not match an unrelated unit for the same cohort', () => {
    expect(allocationMatchesOffering(offering, {
      teachingOfferingId: null,
      cohortId: 'cnd-2026',
      unitId: 'food-production',
      participantCohortIds: ['cnd-2026'],
      unitTitle: 'Food Production',
      sessionDurationMinutes: 120,
    })).toBe(false);
  });

  it('does not merge otherwise similar allocations with a different duration', () => {
    expect(allocationMatchesOffering(offering, {
      teachingOfferingId: 'old-2029-offering',
      cohortId: 'other-cohort',
      unitId: 'other-unit',
      participantCohortIds: ['dnd-2026'],
      unitTitle: 'Communication Skills',
      sessionDurationMinutes: 240,
    })).toBe(false);
  });
});
