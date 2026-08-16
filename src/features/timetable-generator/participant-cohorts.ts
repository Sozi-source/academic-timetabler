export function normalizeParticipantCohortIds({
  cohortId,
  participantCohortIds,
}: {
  cohortId: string;
  participantCohortIds?: string[] | null;
}): string[] {
  return Array.from(
    new Set([
      cohortId,
      ...(participantCohortIds ?? []),
    ].filter(Boolean)),
  ).sort();
}

export function findOverlappingParticipantCohortId({
  firstCohortId,
  firstParticipantCohortIds,
  secondCohortId,
  secondParticipantCohortIds,
}: {
  firstCohortId: string;
  firstParticipantCohortIds?: string[] | null;
  secondCohortId: string;
  secondParticipantCohortIds?: string[] | null;
}): string | undefined {
  const secondCohorts = new Set(
    normalizeParticipantCohortIds({
      cohortId: secondCohortId,
      participantCohortIds:
        secondParticipantCohortIds,
    }),
  );

  return normalizeParticipantCohortIds({
    cohortId: firstCohortId,
    participantCohortIds:
      firstParticipantCohortIds,
  }).find((cohortId) =>
    secondCohorts.has(cohortId),
  );
}
