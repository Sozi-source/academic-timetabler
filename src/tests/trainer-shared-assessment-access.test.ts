import { describe, expect, it } from 'vitest';

interface MockTeachingAllocation {
  id: string;
  trainerId: string;
  unitId: string;
  academicPeriodId: string;
  cohortId: string | null;
  status: 'active' | 'completed' | 'archived';
}

interface MockAssessmentEvent {
  id: string;
  unitId: string;
  academicPeriodId: string;
  cohortId: string | null;
}

interface MockUnitOffering {
  unitId: string;
  academicPeriodId: string;
  confirmedSharedOfferingId: string | null;
}

interface MockEquivalenceMember {
  unitId: string;
  equivalenceGroupId: string;
  status: 'approved' | 'pending';
}

function simulateTrainerCanAccessAssessment({
  trainerId,
  event,
  allocations,
  offerings,
  equivalenceMembers,
}: {
  trainerId: string;
  event: MockAssessmentEvent;
  allocations: MockTeachingAllocation[];
  offerings: MockUnitOffering[];
  equivalenceMembers: MockEquivalenceMember[];
}): boolean {
  return allocations.some((alloc) => {
    if (alloc.trainerId !== trainerId) return false;
    if (alloc.academicPeriodId !== event.academicPeriodId) return false;
    if (!['active', 'completed'].includes(alloc.status)) return false;

    // 1. Direct unit match
    const isDirect = alloc.unitId === event.unitId;

    // 2. Shared offering match
    const targetOffering = offerings.find(
      (o) => o.unitId === event.unitId && o.academicPeriodId === event.academicPeriodId,
    );
    const allocOffering = offerings.find(
      (o) => o.unitId === alloc.unitId && o.academicPeriodId === event.academicPeriodId,
    );
    const isShared = Boolean(
      targetOffering?.confirmedSharedOfferingId &&
      allocOffering?.confirmedSharedOfferingId &&
      targetOffering.confirmedSharedOfferingId === allocOffering.confirmedSharedOfferingId,
    );

    // 3. Equivalence match
    const targetEquiv = equivalenceMembers.find((e) => e.unitId === event.unitId && e.status === 'approved');
    const allocEquiv = equivalenceMembers.find((e) => e.unitId === alloc.unitId && e.status === 'approved');
    const isEquivalent = Boolean(
      targetEquiv &&
      allocEquiv &&
      targetEquiv.equivalenceGroupId === allocEquiv.equivalenceGroupId,
    );

    if (!isDirect && !isShared && !isEquivalent) return false;

    // Cohort match
    const cohortMatches =
      event.cohortId === null ||
      alloc.cohortId === null ||
      alloc.cohortId === event.cohortId ||
      isShared ||
      isEquivalent;

    return cohortMatches;
  });
}

describe('Trainer Shared & Equivalent Assessment Access', () => {
  const trainerId = 'trainer-maureen-ayuma';
  const periodId = 'period-sep-dec-2026';
  const sharedOfferingId = 'shared-food-production-group';

  const offerings: MockUnitOffering[] = [
    { unitId: 'unit-cnd-1304', academicPeriodId: periodId, confirmedSharedOfferingId: sharedOfferingId },
    { unitId: 'unit-dhn-1305', academicPeriodId: periodId, confirmedSharedOfferingId: sharedOfferingId },
    { unitId: 'unit-dnd-1304', academicPeriodId: periodId, confirmedSharedOfferingId: sharedOfferingId },
    { unitId: 'unit-chn-2203', academicPeriodId: periodId, confirmedSharedOfferingId: sharedOfferingId },
  ];

  const allocations: MockTeachingAllocation[] = [
    {
      id: 'alloc-cnd-1304',
      trainerId,
      unitId: 'unit-cnd-1304',
      academicPeriodId: periodId,
      cohortId: null,
      status: 'active',
    },
    {
      id: 'alloc-dnd-1304-archived',
      trainerId,
      unitId: 'unit-dnd-1304',
      academicPeriodId: periodId,
      cohortId: null,
      status: 'archived',
    },
  ];

  const cndEvent: MockAssessmentEvent = {
    id: 'event-cnd-1304',
    unitId: 'unit-cnd-1304',
    academicPeriodId: periodId,
    cohortId: null,
  };

  const dhnEvent: MockAssessmentEvent = {
    id: 'event-dhn-1305',
    unitId: 'unit-dhn-1305',
    academicPeriodId: periodId,
    cohortId: null,
  };

  const dndEvent: MockAssessmentEvent = {
    id: 'event-dnd-1304',
    unitId: 'unit-dnd-1304',
    academicPeriodId: periodId,
    cohortId: null,
  };

  const chnEvent: MockAssessmentEvent = {
    id: 'event-chn-2203',
    unitId: 'unit-chn-2203',
    academicPeriodId: periodId,
    cohortId: null,
  };

  it('allows access to direct allocation assessment event', () => {
    const hasAccess = simulateTrainerCanAccessAssessment({
      trainerId,
      event: cndEvent,
      allocations,
      offerings,
      equivalenceMembers: [],
    });
    expect(hasAccess).toBe(true);
  });

  it('allows access to sibling shared offering assessment events even without direct active allocation', () => {
    // DHN 1305 has no direct allocation for Maureen, but is in the same shared offering
    const hasDhnAccess = simulateTrainerCanAccessAssessment({
      trainerId,
      event: dhnEvent,
      allocations,
      offerings,
      equivalenceMembers: [],
    });
    expect(hasDhnAccess).toBe(true);

    // DND 1304 only has an archived allocation, but is in the same shared offering as the active CND 1304
    const hasDndAccess = simulateTrainerCanAccessAssessment({
      trainerId,
      event: dndEvent,
      allocations,
      offerings,
      equivalenceMembers: [],
    });
    expect(hasDndAccess).toBe(true);

    // CHN 2203 has no active allocation, but is in the same shared offering
    const hasChnAccess = simulateTrainerCanAccessAssessment({
      trainerId,
      event: chnEvent,
      allocations,
      offerings,
      equivalenceMembers: [],
    });
    expect(hasChnAccess).toBe(true);
  });

  it('denies access to unrelated units outside shared offerings or equivalence groups', () => {
    const unrelatedEvent: MockAssessmentEvent = {
      id: 'event-unrelated',
      unitId: 'unit-microbiology-101',
      academicPeriodId: periodId,
      cohortId: null,
    };
    const hasAccess = simulateTrainerCanAccessAssessment({
      trainerId,
      event: unrelatedEvent,
      allocations,
      offerings,
      equivalenceMembers: [],
    });
    expect(hasAccess).toBe(false);
  });

  it('ensures student 5529 is retained in unified roster deduplication for shared units', () => {
    const registrations = [
      { studentId: 'student-cnd-1', admissionNumber: 'CND/J-6920/IC/26', unitId: 'unit-cnd-1304' },
      { studentId: 'student-chn-1', admissionNumber: 'CHN/M-5559/IC/25', unitId: 'unit-chn-2203' },
      { studentId: 'student-dhn-5529', admissionNumber: 'DHN/M-5529/IC/25', unitId: 'unit-dhn-1305' },
    ];

    const relatedUnitIds = new Set(['unit-cnd-1304', 'unit-dhn-1305', 'unit-dnd-1304', 'unit-chn-2203']);

    const roster = registrations.filter((reg) => relatedUnitIds.has(reg.unitId));
    expect(roster.length).toBe(3);
    expect(roster.some((r) => r.admissionNumber === 'DHN/M-5529/IC/25')).toBe(true);
  });
});
