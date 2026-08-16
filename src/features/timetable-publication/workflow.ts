export function getNextTimetableVersionNumber(
  versionNumbers: number[],
) {
  return Math.max(0, ...versionNumbers) + 1;
}

export function getAutomaticTimetableVersionTitle(
  academicPeriodName: string,
  versionNumber: number,
) {
  return `${academicPeriodName.trim()} · v${versionNumber}`;
}
