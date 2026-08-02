import type {
  TeachingOffering,
  TeachingOfferingParticipant,
} from './types';

export function getOfferingCohortIds(
  participants:
    TeachingOfferingParticipant[],
): string[] {
  return Array.from(
    new Set(
      participants.map(
        (participant) =>
          participant.cohortId,
      ),
    ),
  );
}

export function getOfferingUnitIds(
  participants:
    TeachingOfferingParticipant[],
): string[] {
  return Array.from(
    new Set(
      participants.map(
        (participant) =>
          participant.unitId,
      ),
    ),
  );
}

export function getCombinedCohortSize(
  participants:
    TeachingOfferingParticipant[],
): number {
  const uniqueCohorts =
    new Map<
      string,
      number
    >();

  for (const participant of participants) {
    if (!participant.cohort) {
      continue;
    }

    uniqueCohorts.set(
      participant.cohort.id,
      Math.max(
        0,
        participant.cohort.actualSize,
      ),
    );
  }

  return Array.from(
    uniqueCohorts.values(),
  ).reduce(
    (total, size) =>
      total + size,
    0,
  );
}

export function isSharedTeachingOffering(
  offering: Pick<
    TeachingOffering,
    'participants'
  >,
): boolean {
  return (
    getOfferingCohortIds(
      offering.participants ?? [],
    ).length > 1
  );
}

export function getPrimaryOfferingParticipant(
  participants:
    TeachingOfferingParticipant[],
):
  | TeachingOfferingParticipant
  | null {
  return (
    participants.find(
      (participant) =>
        participant.isPrimary,
    ) ??
    participants[0] ??
    null
  );
}