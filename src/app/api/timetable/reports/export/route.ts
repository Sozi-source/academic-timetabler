import { NextRequest, NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { getTimetableReportsData } from '@/features/timetable-reports/queries';
import type { TimetableReportKind, TimetableReportRow } from '@/features/timetable-reports/types';

const reportKinds = new Set<TimetableReportKind>([
  'master',
  'cohort',
  'trainer',
  'room',
  'workload',
]);

function escapeCsv(value: string | number | boolean) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sessionRows(rows: TimetableReportRow[]) {
  const header = [
    'Day',
    'Start',
    'End',
    'Duration Minutes',
    'Cohort',
    'Cohort Size',
    'Unit Code',
    'Unit Name',
    'Trainer',
    'Room Code',
    'Room Name',
    'Status',
    'Locked',
  ];

  return [
    header,
    ...rows.map((row) => [
      row.day,
      row.startsAt,
      row.endsAt,
      row.durationMinutes,
      row.cohort,
      row.cohortSize,
      row.unitCode,
      row.unitName,
      row.trainer,
      row.roomCode,
      row.roomName,
      row.status,
      row.isLocked,
    ]),
  ];
}

export async function GET(request: NextRequest) {
  await requireHodAccess();
  const academicPeriodId = request.nextUrl.searchParams.get('academicPeriodId');
  const requestedReport = request.nextUrl.searchParams.get('report') as TimetableReportKind | null;

  if (!academicPeriodId || !requestedReport || !reportKinds.has(requestedReport)) {
    return NextResponse.json({ message: 'Invalid timetable report request.' }, { status: 400 });
  }

  const data = await getTimetableReportsData(academicPeriodId);
  const rows = requestedReport === 'workload'
    ? [
        ['Trainer', 'Sessions', 'Contact Hours', 'Distinct Cohorts', 'Distinct Units'],
        ...data.workload.map((group) => [
          group.label,
          group.sessionCount,
          group.contactHours,
          new Set(group.rows.map((row) => row.cohort)).size,
          new Set(group.rows.map((row) => row.unitCode)).size,
        ]),
      ]
    : sessionRows(data.rows);

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="timetable-${requestedReport}-${academicPeriodId}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
