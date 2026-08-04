import type {
  TimetableReportGroup,
  TimetableReportRow,
  TimetableReportsData,
} from './types';

function roundHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function sortRows(rows: TimetableReportRow[]) {
  return [...rows].sort((left, right) => {
    if (left.daySequence !== right.daySequence) {
      return left.daySequence - right.daySequence;
    }

    return left.startsAt.localeCompare(right.startsAt);
  });
}

function groupRows(
  rows: TimetableReportRow[],
  keySelector: (row: TimetableReportRow) => string,
  labelSelector: (row: TimetableReportRow) => string,
  secondarySelector?: (row: TimetableReportRow) => string,
): TimetableReportGroup[] {
  const groups = new Map<string, TimetableReportRow[]>();

  for (const row of rows) {
    const key = keySelector(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, groupedRows]) => {
      const first = groupedRows[0];
      const totalMinutes = groupedRows.reduce(
        (sum, row) => sum + row.durationMinutes,
        0,
      );

      return {
        key,
        label: labelSelector(first),
        secondaryLabel: secondarySelector?.(first),
        sessionCount: groupedRows.length,
        contactHours: roundHours(totalMinutes),
        rows: sortRows(groupedRows),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildTimetableReports(
  rows: TimetableReportRow[],
): TimetableReportsData {
  const sortedRows = sortRows(rows);
  const totalMinutes = rows.reduce(
    (sum, row) => sum + row.durationMinutes,
    0,
  );

  const byTrainer = groupRows(
    rows,
    (row) => row.trainer,
    (row) => row.trainer,
  );

  return {
    rows: sortedRows,
    summary: {
      totalSessions: rows.length,
      totalContactHours: roundHours(totalMinutes),
      distinctCohorts: new Set(rows.map((row) => row.cohort)).size,
      distinctTrainers: new Set(rows.map((row) => row.trainer)).size,
      distinctRooms: new Set(rows.map((row) => row.roomCode)).size,
      lockedSessions: rows.filter((row) => row.isLocked).length,
    },
    byCohort: groupRows(
      rows,
      (row) => row.cohort,
      (row) => row.cohort,
      (row) => `${row.cohortSize} learners`,
    ),
    byTrainer,
    byRoom: groupRows(
      rows,
      (row) => row.roomCode,
      (row) => `${row.roomCode} · ${row.roomName}`,
    ),
    workload: [...byTrainer].sort((left, right) => {
      if (right.contactHours !== left.contactHours) {
        return right.contactHours - left.contactHours;
      }

      return left.label.localeCompare(right.label);
    }),
  };
}
