import type {
  DepartmentAttendanceSession,
} from './admin-types';

export interface DepartmentAttendanceSummary {
  sessions:
    number;
  completed:
    number;
  open:
    number;
  present:
    number;
  absent:
    number;
  unmarked:
    number;
  attendanceRate:
    number |
    null;
}

export function departmentAttendanceSummary(
  rows:
    DepartmentAttendanceSession[],
): DepartmentAttendanceSummary {
  const present =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.presentCount,
      0,
    );

  const absent =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.absentCount,
      0,
    );

  const unmarked =
    rows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.unmarkedCount,
      0,
    );

  const marked =
    present +
    absent;

  return {
    sessions:
      rows.length,
    completed:
      rows.filter(
        (row) =>
          row.sessionStatus ===
          'completed',
      ).length,
    open:
      rows.filter(
        (row) =>
          row.sessionStatus ===
          'open',
      ).length,
    present,
    absent,
    unmarked,
    attendanceRate:
      marked >
      0
        ? (
            present /
            marked
          ) *
          100
        : null,
  };
}

export function formatAttendanceRate(
  value:
    number |
    null,
): string {
  if (
    value ===
    null
  ) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}
