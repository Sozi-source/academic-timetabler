export function attendanceRate({
  present,
  absent,
}: {
  present: number;
  absent: number;
}): number | null {
  const denominator =
    present +
    absent;

  if (
    denominator <=
    0
  ) {
    return null;
  }

  return Math.round(
    (
      present /
      denominator
    ) *
      1000,
  ) / 10;
}

export function attendanceRateLabel(
  value: number | null,
): string {
  return value ===
    null
    ? '—'
    : `${value.toFixed(1)}%`;
}

export function attendanceCountLabel({
  present,
  absent,
}: {
  present: number;
  absent: number;
}): string {
  return `${present} present · ${absent} absent`;
}
