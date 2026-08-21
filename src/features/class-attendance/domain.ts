import type {
  ClassAttendanceStatus,
} from './types';

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
  status:
    ClassAttendanceStatus,
): string {
  switch (
    status
  ) {
    case 'present':
      return 'Present';

    case 'absent':
      return 'Absent';

    default:
      return 'Unmarked';
  }
}

export function classAttendanceStatusVariant(
  status:
    ClassAttendanceStatus,
):
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info' {
  switch (
    status
  ) {
    case 'present':
      return 'success';

    case 'absent':
      return 'danger';

    default:
      return 'neutral';
  }
}

export function classAttendanceSummary(
  statuses:
    ClassAttendanceStatus[],
) {
  const count =
    (
      status:
        ClassAttendanceStatus,
    ) =>
      statuses.filter(
        (value) =>
          value ===
          status,
      ).length;

  return {
    total:
      statuses.length,
    present:
      count(
        'present',
      ),
    absent:
      count(
        'absent',
      ),
    unmarked:
      count(
        'unmarked',
      ),
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
