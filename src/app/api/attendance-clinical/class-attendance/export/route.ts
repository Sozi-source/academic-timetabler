import ExcelJS from 'exceljs';
import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  attendanceRateLabel,
} from '@/features/attendance-analytics/domain';
import {
  getDepartmentAttendanceAnalytics,
  getDepartmentStudentAttendanceAnalytics,
} from '@/features/attendance-analytics/queries';

function styleHeader(
  row: ExcelJS.Row,
) {
  row.font = {
    bold:
      true,
  };

  row.alignment = {
    vertical:
      'middle',
    wrapText:
      true,
  };
}

function styleSheet(
  sheet: ExcelJS.Worksheet,
) {
  sheet.views = [
    {
      state:
        'frozen',
      ySplit:
        1,
    },
  ];

  sheet.autoFilter = {
    from:
      'A1',
    to: {
      row:
        1,
      column:
        sheet.columnCount,
    },
  };

  sheet.eachRow(
    (row) => {
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: 'top',
          wrapText: colNumber !== 2,
        };
      });
    },
  );
}

function safeFilename(
  value: string,
) {
  return value
    .replace(
      /[^a-z0-9]+/gi,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    )
    .toLowerCase();
}

export async function GET() {
  await requireHodAccess();

  const [
    aggregates,
    students,
  ] =
    await Promise.all([
      getDepartmentAttendanceAnalytics(),
      getDepartmentStudentAttendanceAnalytics(),
    ]);

  const periodName =
    aggregates[0]
      ?.academicPeriodName ??
    students[0]
      ?.academicPeriodName ??
    'active-period';

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Academic Planner';

  workbook.created =
    new Date();

  const summary =
    workbook.addWorksheet(
      'Unit Summary',
    );

  summary.columns = [
    {
      header:
        'Academic Period',
      width:
        24,
    },
    {
      header:
        'Unit',
      width:
        34,
    },
    {
      header:
        'Cohort',
      width:
        28,
    },
    {
      header:
        'Trainer',
      width:
        30,
    },
    {
      header:
        'Completed Sessions',
      width:
        18,
    },
    {
      header:
        'Roster Occurrences',
      width:
        18,
    },
    {
      header:
        'Present',
      width:
        12,
    },
    {
      header:
        'Absent',
      width:
        12,
    },
    {
      header:
        'Attendance Rate',
      width:
        18,
    },
  ];

  styleHeader(
    summary.getRow(
      1,
    ),
  );

  for (
    const item of
      aggregates
  ) {
    summary.addRow([
      item.academicPeriodName,
      item.unitName,
      item.cohortName,
      item.trainerName,
      item.completedSessions,
      item.rosterOccurrences,
      item.presentCount,
      item.absentCount,
      attendanceRateLabel(
        item.attendanceRate,
      ),
    ]);
  }

  styleSheet(
    summary,
  );

  const detail =
    workbook.addWorksheet(
      'Student Detail',
    );

  detail.columns = [
    {
      header:
        'Academic Period',
      width:
        24,
    },
    {
      header:
        'Admission Number',
      width:
        28,
    },
    {
      header:
        'Student Name',
      width:
        34,
    },
    {
      header:
        'Cohort',
      width:
        28,
    },
    {
      header:
        'Unit',
      width:
        34,
    },
    {
      header:
        'Completed Sessions',
      width:
        18,
    },
    {
      header:
        'Present',
      width:
        12,
    },
    {
      header:
        'Absent',
      width:
        12,
    },
    {
      header:
        'Attendance Rate',
      width:
        18,
    },
  ];

  styleHeader(
    detail.getRow(
      1,
    ),
  );

  for (
    const item of
      students
  ) {
    detail.addRow([
      item.academicPeriodName,
      item.admissionNumber,
      item.fullName,
      item.cohortName,
      item.unitName,
      item.completedSessions,
      item.presentCount,
      item.absentCount,
      attendanceRateLabel(
        item.attendanceRate,
      ),
    ]);
  }

  styleSheet(
    detail,
  );

  const buffer =
    await workbook.xlsx.writeBuffer();

  return new NextResponse(
    new Uint8Array(
      buffer,
    ),
    {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          `attachment; filename="class-attendance-${safeFilename(
            periodName,
          )}.xlsx"`,
        'Cache-Control':
          'no-store',
        'X-Content-Type-Options':
          'nosniff',
      },
    },
  );
}
