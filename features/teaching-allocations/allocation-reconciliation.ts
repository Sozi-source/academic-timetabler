import { buildSharedClassMatchKey } from './shared-class-matching';

export interface OfferingAllocationIdentity {
  teachingOfferingId: string | null;
  participants: Array<{
    cohortId: string;
    unitId: string;
    unitOfferingId?: string | null;
  }>;
  title: string;
  sessionDurationMinutes: number;
}

export interface CurrentAllocationIdentity {
  teachingOfferingId: string | null;
  sourceUnitOfferingId?: string | null;
  cohortId: string;
  unitId: string;
  participantCohortIds: string[];
  unitTitle: string | null;
  sessionDurationMinutes: number;
}

export function allocationMatchesOffering(
  offering: OfferingAllocationIdentity,
  allocation: CurrentAllocationIdentity,
) {
  if (allocation.sourceUnitOfferingId) {
    return offering.participants.some(
      (participant) =>
        participant.unitOfferingId === allocation.sourceUnitOfferingId,
    );
  }

  if (allocation.teachingOfferingId) {
    return allocation.teachingOfferingId === offering.teachingOfferingId;
  }

  if (
    offering.participants.some((participant) =>
      participant.cohortId === allocation.cohortId &&
      participant.unitId === allocation.unitId,
    )
  ) {
    return true;
  }

  if (!allocation.unitTitle) {
    return false;
  }

  const sharesParticipant = offering.participants.some((participant) =>
    allocation.participantCohortIds.includes(participant.cohortId),
  );

  if (!sharesParticipant) {
    return false;
  }

  return buildSharedClassMatchKey({
    title: offering.title,
    sessionDurationMinutes: offering.sessionDurationMinutes,
  }) === buildSharedClassMatchKey({
    title: allocation.unitTitle,
    sessionDurationMinutes: allocation.sessionDurationMinutes,
  });
}
