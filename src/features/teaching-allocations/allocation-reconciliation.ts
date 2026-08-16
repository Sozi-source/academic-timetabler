import { buildSharedClassMatchKey } from './shared-class-matching';

export interface OfferingAllocationIdentity {
  teachingOfferingId: string | null;
  participants: Array<{
    cohortId: string;
    unitId: string;
  }>;
  title: string;
  sessionDurationMinutes: number;
}

export interface CurrentAllocationIdentity {
  teachingOfferingId: string | null;
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
  if (
    allocation.teachingOfferingId &&
    allocation.teachingOfferingId === offering.teachingOfferingId
  ) {
    return true;
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
