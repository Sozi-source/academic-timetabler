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

  const assignedRows = rows.filter(
    (row): row is TimetableReportRow & { trainerId: string } => Boolean(row.trainerId),
  );

  const byTrainer = groupRows(
    assignedRows,
    (row) => row.trainerId,
    (row) => row.trainer,
  ).map((group) => {
    const targetHours = group.rows[0]?.trainerTargetHours ?? 0;
    return {
      ...group,
      targetHours,
      extraHours: Math.max(0, roundHours((group.contactHours - targetHours) * 60)),
    };
  });

  return {
    rows: sortedRows,
    summary: {
      totalSessions: rows.length,
      totalContactHours: roundHours(totalMinutes),
      distinctCohorts: new Set(rows.map((row) => row.cohort)).size,
      distinctTrainers: new Set(assignedRows.map((row) => row.trainerId)).size,
      distinctRooms: new Set(rows.map((row) => row.roomCode).filter(Boolean)).size,
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
      (row) => row.roomCode ?? 'UNASSIGNED',
      (row) => row.roomCode ? `${row.roomCode} · ${row.roomName}` : 'No room assigned',
    ),
    workload: [...byTrainer].sort((left, right) => {
      if (right.contactHours !== left.contactHours) {
        return right.contactHours - left.contactHours;
      }

      return left.label.localeCompare(right.label);
    }),
  };
}
