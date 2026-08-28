import {
  generateTimetablePlan,
  type AutomaticPlannerInput,
  type AutomaticPlannerResult,
} from './planner';

export interface PlanningTrainerExchangeSuggestion {
  id: string;
  targetTeachingAllocationId: string;
  targetSessionNumber: number;
  partnerTeachingAllocationId: string;
  targetTrainerId: string;
  partnerTrainerId: string;
  durationMinutes: number;
  resolvedSessionCount: number;
  remainingUnscheduledCount: number;
  warningCount: number;
  score: number;
}

export interface FindTrainerExchangeSuggestionsOptions {
  maximumSuggestionsPerSession?: number;
  maximumSimulations?: number;
}

function hasProtectedSession(
  input: AutomaticPlannerInput,
  teachingAllocationId: string,
) {
  return (input.existingSessions ?? []).some((session) =>
    session.teachingAllocationId === teachingAllocationId &&
    (
      session.isExternal ||
      session.isLocked ||
      session.status === 'locked'
    ),
  );
}

function isDepartmentTrainer(
  input: AutomaticPlannerInput,
  trainerId: string,
) {
  const trainer = input.trainers.find((candidate) => candidate.id === trainerId);

  return Boolean(
    trainer &&
    input.activeDepartmentId &&
    trainer.departmentId === input.activeDepartmentId,
  );
}

function isTrainerEligibleForUnit(
  input: AutomaticPlannerInput,
  trainerId: string,
  unitId: string,
) {
  const eligibility = input.trainerUnitEligibility ?? [];
  const unitHasRestrictions = eligibility.some((entry) => entry.unitId === unitId);

  return !unitHasRestrictions || eligibility.some((entry) =>
    entry.unitId === unitId && entry.trainerId === trainerId,
  );
}

function createSwappedInput({
  input,
  targetTeachingAllocationId,
  partnerTeachingAllocationId,
  targetTrainerId,
  partnerTrainerId,
}: {
  input: AutomaticPlannerInput;
  targetTeachingAllocationId: string;
  partnerTeachingAllocationId: string;
  targetTrainerId: string;
  partnerTrainerId: string;
}): AutomaticPlannerInput {
  return {
    ...input,
    allocations: input.allocations.map((allocation) => {
      if (allocation.id === targetTeachingAllocationId) {
        return {
          ...allocation,
          trainerId: partnerTrainerId,
        };
      }

      if (allocation.id === partnerTeachingAllocationId) {
        return {
          ...allocation,
          trainerId: targetTrainerId,
        };
      }

      return allocation;
    }),
  };
}

function countUnscheduledForAllocation(
  result: AutomaticPlannerResult,
  teachingAllocationId: string,
) {
  return result.unscheduled.filter((session) =>
    session.teachingAllocationId === teachingAllocationId,
  ).length;
}

export function evaluateTrainerExchangeSuggestion({
  input,
  baseline,
  targetTeachingAllocationId,
  targetSessionNumber,
  partnerTeachingAllocationId,
}: {
  input: AutomaticPlannerInput;
  baseline: AutomaticPlannerResult;
  targetTeachingAllocationId: string;
  targetSessionNumber: number;
  partnerTeachingAllocationId: string;
}): PlanningTrainerExchangeSuggestion | null {
  const unresolved = baseline.unscheduled.find((session) =>
    session.teachingAllocationId === targetTeachingAllocationId &&
    session.sessionNumber === targetSessionNumber &&
    session.reason === 'no_valid_placement',
  );
  const target = input.allocations.find((allocation) =>
    allocation.id === targetTeachingAllocationId,
  );
  const partner = input.allocations.find((allocation) =>
    allocation.id === partnerTeachingAllocationId,
  );
  const targetTrainerId = target?.trainerId ?? null;
  const partnerTrainerId = partner?.trainerId ?? null;

  if (
    !unresolved ||
    !target ||
    !partner ||
    !targetTrainerId ||
    !partnerTrainerId ||
    target.id === partner.id ||
    partner.academicPeriodId !== target.academicPeriodId ||
    !target.isTimetableEnabled ||
    !partner.isTimetableEnabled ||
    partner.sessionDurationMinutes !== target.sessionDurationMinutes ||
    partnerTrainerId === targetTrainerId ||
    !isDepartmentTrainer(input, targetTrainerId) ||
    !isDepartmentTrainer(input, partnerTrainerId) ||
    !isTrainerEligibleForUnit(input, partnerTrainerId, target.unitId) ||
    !isTrainerEligibleForUnit(input, targetTrainerId, partner.unitId) ||
    hasProtectedSession(input, target.id) ||
    hasProtectedSession(input, partner.id)
  ) {
    return null;
  }

  const simulation = generateTimetablePlan(
    createSwappedInput({
      input,
      targetTeachingAllocationId: target.id,
      partnerTeachingAllocationId: partner.id,
      targetTrainerId,
      partnerTrainerId,
    }),
  );
  const targetStillUnscheduled = simulation.unscheduled.some((session) =>
    session.teachingAllocationId === target.id &&
    session.sessionNumber === unresolved.sessionNumber,
  );
  const partnerUnscheduledCount =
    countUnscheduledForAllocation(simulation, partner.id);
  const blockedConflictCount = simulation.conflicts.filter(
    (conflict) => conflict.severity === 'blocked',
  ).length;
  const resolvedSessionCount =
    baseline.unscheduled.length - simulation.unscheduled.length;

  if (
    targetStillUnscheduled ||
    partnerUnscheduledCount > 0 ||
    resolvedSessionCount <= 0 ||
    blockedConflictCount > 0
  ) {
    return null;
  }

  const warningCount = simulation.conflicts.filter(
    (conflict) => conflict.severity === 'warning',
  ).length;

  return {
    id: [
      'trainer-exchange',
      target.id,
      unresolved.sessionNumber,
      partner.id,
    ].join(':'),
    targetTeachingAllocationId: target.id,
    targetSessionNumber: unresolved.sessionNumber,
    partnerTeachingAllocationId: partner.id,
    targetTrainerId,
    partnerTrainerId,
    durationMinutes: target.sessionDurationMinutes,
    resolvedSessionCount,
    remainingUnscheduledCount: simulation.unscheduled.length,
    warningCount,
    score:
      resolvedSessionCount * 1000 -
      warningCount * 10 -
      Math.abs(target.weeklySessions - partner.weeklySessions),
  };
}

export function findTrainerExchangeSuggestions({
  input,
  baseline,
  options = {},
}: {
  input: AutomaticPlannerInput;
  baseline: AutomaticPlannerResult;
  options?: FindTrainerExchangeSuggestionsOptions;
}): PlanningTrainerExchangeSuggestion[] {
  if (baseline.unscheduled.length === 0) {
    return [];
  }

  const maximumSuggestionsPerSession =
    options.maximumSuggestionsPerSession ?? 3;
  const maximumSimulations =
    options.maximumSimulations ?? 36;
  const maximumSimulationsPerRequest = Math.max(
    maximumSuggestionsPerSession,
    Math.floor(
      maximumSimulations /
      Math.max(1, baseline.unscheduled.length),
    ),
  );
  const allocationLookup = new Map(
    input.allocations.map((allocation) => [
      allocation.id,
      allocation,
    ]),
  );
  const trainerLookup = new Map(
    input.trainers.map((trainer) => [
      trainer.id,
      trainer,
    ]),
  );
  const suggestions: PlanningTrainerExchangeSuggestion[] = [];
  const processedRequests = new Set<string>();
  let simulationCount = 0;

  for (const unresolved of baseline.unscheduled) {
    if (
      unresolved.reason !== 'no_valid_placement' ||
      simulationCount >= maximumSimulations
    ) {
      continue;
    }

    const requestKey = [
      unresolved.teachingAllocationId,
      unresolved.sessionNumber,
    ].join(':');
    if (processedRequests.has(requestKey)) {
      continue;
    }
    processedRequests.add(requestKey);

    const target = allocationLookup.get(
      unresolved.teachingAllocationId,
    );
    if (
      !target?.trainerId ||
      hasProtectedSession(input, target.id)
    ) {
      continue;
    }

    const targetTrainer = trainerLookup.get(target.trainerId);
    if (!targetTrainer) {
      continue;
    }

    const partnerCandidates = input.allocations
      .filter((partner) =>
        partner.id !== target.id &&
        partner.academicPeriodId === target.academicPeriodId &&
        partner.isTimetableEnabled &&
        partner.sessionDurationMinutes === target.sessionDurationMinutes &&
        Boolean(partner.trainerId) &&
        partner.trainerId !== target.trainerId &&
        Boolean(partner.trainerId && trainerLookup.has(partner.trainerId)) &&
        !hasProtectedSession(input, partner.id),
      )
      .sort((first, second) => {
        const firstTrainer = first.trainerId
          ? trainerLookup.get(first.trainerId)
          : undefined;
        const secondTrainer = second.trainerId
          ? trainerLookup.get(second.trainerId)
          : undefined;
        const firstSelected = Number(
          firstTrainer?.availabilityMode === 'selected_slots_only',
        );
        const secondSelected = Number(
          secondTrainer?.availabilityMode === 'selected_slots_only',
        );

        return firstSelected - secondSelected ||
          Math.abs(target.weeklySessions - first.weeklySessions) -
            Math.abs(target.weeklySessions - second.weeklySessions) ||
          first.id.localeCompare(second.id);
      });

    const requestSuggestions: PlanningTrainerExchangeSuggestion[] = [];
    let requestSimulationCount = 0;

    for (const partner of partnerCandidates) {
      if (
        simulationCount >= maximumSimulations ||
        requestSimulationCount >= maximumSimulationsPerRequest ||
        requestSuggestions.length >= maximumSuggestionsPerSession
      ) {
        break;
      }

      simulationCount += 1;
      requestSimulationCount += 1;
      const suggestion = evaluateTrainerExchangeSuggestion({
        input,
        baseline,
        targetTeachingAllocationId: target.id,
        targetSessionNumber: unresolved.sessionNumber,
        partnerTeachingAllocationId: partner.id,
      });

      if (suggestion) {
        requestSuggestions.push(suggestion);
      }
    }

    suggestions.push(...requestSuggestions.sort((first, second) =>
      second.score - first.score ||
      first.partnerTeachingAllocationId.localeCompare(
        second.partnerTeachingAllocationId,
      ),
    ));
  }

  return suggestions;
}
