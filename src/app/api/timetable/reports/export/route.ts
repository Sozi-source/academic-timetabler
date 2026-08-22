import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';

import { getAcademicPeriodById } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  getInstitutionTrainerTimetableReportsData,
  getTimetableReportsData,
} from '@/features/timetable-reports/queries';
import {
  buildMasterTimetableDocx,
  buildPersonalTimetablesDocx,
} from '@/features/timetable-reports/template-docx';
import { TimetableTemplateDocument } from '@/features/timetable-reports/template-pdf';
import type { TimetableReportKind, TimetableReportRow } from '@/features/timetable-reports/types';

const reportKinds = new Set<TimetableReportKind>([
  'master',
  'cohort',
  'trainer',
  'room',
  'workload',
]);

export const runtime = 'nodejs';

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
    'Department Code',
    'Department Name',
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
      row.departmentCode ?? '',
      row.departmentName ?? '',
      row.roomCode,
      row.roomName,
      row.status === 'draft' ? 'Scheduled' : row.status,
      row.isLocked,
    ]),
  ];
}

export async function GET(request: NextRequest) {
  const profile = await requireHodAccess();
  const academicPeriodId = request.nextUrl.searchParams.get('academicPeriodId');
  const requestedReport = request.nextUrl.searchParams.get('report') as TimetableReportKind | null;
  const format = request.nextUrl.searchParams.get('format') ?? 'csv';

  if (!academicPeriodId || !requestedReport || !reportKinds.has(requestedReport)) {
    return NextResponse.json({ message: 'Invalid timetable report request.' }, { status: 400 });
  }

  const data = requestedReport === 'trainer' || requestedReport === 'workload'
    ? await getInstitutionTrainerTimetableReportsData(academicPeriodId)
    : await getTimetableReportsData(academicPeriodId);

  if (format === 'docx') {
    if (requestedReport !== 'master' && requestedReport !== 'trainer') {
      return NextResponse.json(
        { message: 'Editable Word export is available for master and trainer timetables.' },
        { status: 400 },
      );
    }

    const period = await getAcademicPeriodById(academicPeriodId);
    if (!period) {
      return NextResponse.json({ message: 'The Academic Period was not found.' }, { status: 404 });
    }

    const generatedOn = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Nairobi',
    }).format(new Date());
    const periodLabel = `${period.name} (${period.code})`;
    const docx = requestedReport === 'master'
      ? await buildMasterTimetableDocx({
          data,
          departmentName: profile.departmentName,
          periodLabel,
          generatedOn,
        })
      : await buildPersonalTimetablesDocx({
          data,
          periodLabel,
          generatedOn,
        });
    const exportName = requestedReport === 'master'
      ? 'department-master-timetable'
      : 'personal-trainer-timetables';

    return new NextResponse(new Uint8Array(docx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${exportName}-${period.code}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    if (requestedReport !== 'master' && requestedReport !== 'trainer') {
      return NextResponse.json(
        { message: 'Template PDF export is available for master and trainer timetables.' },
        { status: 400 },
      );
    }

    const period = await getAcademicPeriodById(academicPeriodId);
    if (!period) {
      return NextResponse.json({ message: 'The Academic Period was not found.' }, { status: 404 });
    }

    const generatedOn = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Nairobi',
    }).format(new Date());
    const document = React.createElement(TimetableTemplateDocument, {
      report: requestedReport,
      data,
      departmentName: profile.departmentName,
      periodLabel: `${period.name} (${period.code})`,
      generatedOn,
    });
    const pdf = await renderToBuffer(
      document as unknown as React.ReactElement<DocumentProps>,
    );
    const exportName = requestedReport === 'master'
      ? 'department-master-timetable'
      : 'personal-timetables';

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportName}-${period.code}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format !== 'csv') {
    return NextResponse.json({ message: 'Unsupported export format.' }, { status: 400 });
  }

  const rows = requestedReport === 'workload'
    ? [
        ['Trainer', 'Sessions', 'Target Hours', 'Scheduled Hours', 'Extra Hours', 'Status', 'Distinct Cohorts', 'Distinct Units'],
        ...data.workload.map((group) => [
          group.label,
          group.sessionCount,
          group.targetHours ?? 0,
          group.contactHours,
          group.extraHours ?? 0,
          (group.extraHours ?? 0) > 0 ? 'Extra hours' : 'Within target',
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
