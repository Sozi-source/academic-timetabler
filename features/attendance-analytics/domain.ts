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

export const COLLEGE_MINIMUM_ATTENDANCE_PERCENT = 80.0;

export type AttendanceStanding = 'good' | 'borderline' | 'at_risk' | 'unrecorded';

export function getAttendanceStanding(rate: number | null): AttendanceStanding {
  if (rate === null) return 'unrecorded';
  if (rate < COLLEGE_MINIMUM_ATTENDANCE_PERCENT) return 'at_risk';
  if (rate < 85.0) return 'borderline';
  return 'good';
}

export function getAttendanceStandingLabel(standing: AttendanceStanding): string {
  switch (standing) {
    case 'good':
      return 'In Good Standing';
    case 'borderline':
      return 'Borderline (Cleared)';
    case 'at_risk':
      return 'At Risk (< 80%)';
    case 'unrecorded':
      return 'Unrecorded';
  }
}

export function getAttendanceBadgeVariant(
  rate: number | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const standing = getAttendanceStanding(rate);
  switch (standing) {
    case 'good':
      return 'success';
    case 'borderline':
      return 'warning';
    case 'at_risk':
      return 'danger';
    case 'unrecorded':
      return 'neutral';
  }
}

