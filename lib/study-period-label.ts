export const STUDY_SEMESTERS_PER_YEAR = 3;

export function formatStudyPeriod(
  academicPeriodNumber: number | null | undefined,
): string {
  if (
    academicPeriodNumber === null ||
    academicPeriodNumber === undefined ||
    !Number.isFinite(academicPeriodNumber)
  ) {
    return 'â€”';
  }

  const period = Math.trunc(academicPeriodNumber);

  if (period < 1) {
    return 'â€”';
  }

  const year =
    Math.floor(
      (period - 1) / STUDY_SEMESTERS_PER_YEAR,
    ) + 1;

  const semester =
    ((period - 1) % STUDY_SEMESTERS_PER_YEAR) + 1;

  return `Y${year}S${semester}`;
}