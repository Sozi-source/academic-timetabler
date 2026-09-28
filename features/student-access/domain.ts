import type {
  StudentPortalAccessRow,
  StudentPortalAccessStatus,
  StudentPortalAccessSummary,
} from './types';

export function studentPortalAccessStatus(
  row:
    Pick<
      StudentPortalAccessRow,
      | 'hasCredential'
      | 'isActive'
      | 'lockedUntil'
    >,
  now:
    Date =
      new Date(),
): StudentPortalAccessStatus {
  if (
    !row.hasCredential
  ) {
    return 'not_issued';
  }

  if (
    !row.isActive
  ) {
    return 'disabled';
  }

  if (
    row.lockedUntil &&
    new Date(
      row.lockedUntil,
    ).getTime() >
      now.getTime()
  ) {
    return 'locked';
  }

  return 'active';
}

export function studentPortalAccessStatusLabel(
  status:
    StudentPortalAccessStatus,
): string {
  switch (
    status
  ) {
    case 'not_issued':
      return 'Not issued';

    case 'disabled':
      return 'Disabled';

    case 'locked':
      return 'Locked';

    default:
      return 'Active';
  }
}

export function studentPortalAccessSummary(
  rows:
    StudentPortalAccessRow[],
  now:
    Date =
      new Date(),
): StudentPortalAccessSummary {
  const statuses =
    rows.map(
      (row) =>
        studentPortalAccessStatus(
          row,
          now,
        ),
    );

  return {
    eligible:
      rows.length,
    issued:
      rows.filter(
        (row) =>
          row.hasCredential,
      ).length,
    active:
      statuses.filter(
        (status) =>
          status ===
          'active',
      ).length,
    notIssued:
      statuses.filter(
        (status) =>
          status ===
          'not_issued',
      ).length,
    disabled:
      statuses.filter(
        (status) =>
          status ===
          'disabled',
      ).length,
    locked:
      statuses.filter(
        (status) =>
          status ===
          'locked',
      ).length,
    neverSignedIn:
      rows.filter(
        (row) =>
          row.hasCredential &&
          !row.lastLoginAt,
      ).length,
  };
}

export function formatStudentPortalAccessTime(
  value:
    string | null,
): string {
  if (!value) {
    return 'Never';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-KE',
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}
