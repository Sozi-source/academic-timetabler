import type {
  ClassAttendanceStatus,
} from './types';

export const ABSENT_CIRCUMSTANCES = [
  'Leave of absence',
  'Pending unit registration',
  'Medical / Sickness',
  'Official college duty',
  'Fee clearance / Admin',
] as const;

export type AbsentCircumstance = (typeof ABSENT_CIRCUMSTANCES)[number];

export const classAttendanceOptions:
  ReadonlyArray<{
    value:
      Exclude<
        ClassAttendanceStatus,
        'unmarked'
      >;
    label:
      string;
    shortLabel:
      string;
  }> = [
    {
      value:
        'present',
      label:
        'Present',
      shortLabel:
        'P',
    },
    {
      value:
        'absent',
      label:
        'Absent',
      shortLabel:
        'A',
    },
  ];

export function classAttendanceStatusLabel(
  status: ClassAttendanceStatus,
): string {
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    default:
      return 'Unmarked';
  }
}

export function classAttendanceStatusVariant(
  status: ClassAttendanceStatus,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'present':
      return 'success';
    case 'absent':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function classAttendanceSummary(
  statuses: ClassAttendanceStatus[],
) {
  const count = (status: ClassAttendanceStatus) =>
    statuses.filter((value) => value === status).length;

  return {
    total: statuses.length,
    present: count('present'),
    absent: count('absent'),
    unmarked: count('unmarked'),
  };
}

export function canCompleteClassAttendance(
  statuses:
    ClassAttendanceStatus[],
): boolean {
  return (
    statuses.length >
      0 &&
    statuses.every(
      (status) =>
        status !==
        'unmarked',
    )
  );
}

export function weekdayLabel(
  value:
    string,
): string {
  return value
    .replace(
      /^\w/,
      (letter) =>
        letter.toUpperCase(),
    );
}

export function shortTime(
  value:
    string,
): string {
  return value
    .slice(
      0,
      5,
    );
}

/**
 * Formats a student's full name to two primary names (e.g. Surname and First Name)
 * for compact, native mobile attendance and daily report displays.
 * e.g., "OCHIENG, BRIDGITE ATIENO" -> "OCHIENG BRIDGITE"
 * e.g., "MARY WANJIKU KAMAU" -> "MARY WANJIKU"
 */
export function formatStudentTwoNames(fullName?: string | null): string {
  if (!fullName) return '';
  const parts = fullName
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[1]}`;
}
