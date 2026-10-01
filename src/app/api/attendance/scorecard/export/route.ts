import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { getAttendanceStandingLabel } from '@/features/attendance-analytics/domain';
import { getDepartmentStudentAttendanceScorecard } from '@/features/class-attendance/scorecard-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await requireHodAccess();

  const url = new URL(request.url);
  const periodId = url.searchParams.get('periodId') || undefined;
  const cohortFilter = url.searchParams.get('cohortId') || undefined;

  const scorecard = await getDepartmentStudentAttendanceScorecard(periodId);

  const students = cohortFilter && cohortFilter !== 'all'
    ? scorecard.students.filter((s) => s.cohortId === cohortFilter)
    : scorecard.students;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  const worksheet = workbook.addWorksheet('Attendance Scorecard');

  // Freeze top 4 header rows
  worksheet.views = [{ state: 'frozen', ySplit: 4 }];

  // 1. Institution Header Banner
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF033B36' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A2:J2');
  const subCell = worksheet.getCell('A2');
  subCell.value = `STUDENT CLASS ATTENDANCE SCORECARD & SUBJECT BREAKDOWN — ${scorecard.academicPeriodName.toUpperCase()}`;
  subCell.font = { bold: true, size: 11, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.addRow([]); // Blank row 3

  // Unit columns
  const unitCols = scorecard.allUnits;

  // Header row 4
  const headers = [
    'S/No',
    'Admission Number',
    'Student Full Name',
    'Cohort',
    'Programme',
    ...unitCols.map((u) => `${u.code} (%)`),
    'Overall Attendance (%)',
    'Standing',
    'Sessions Present',
    'Total Sessions Held',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;
  headerRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF033B36' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Student rows
  students.forEach((student, index) => {
    const unitMap = new Map(student.units.map((u) => [u.unitId, u]));
    const unitValues = unitCols.map((col) => {
      const u = unitMap.get(col.id);
      if (!u) return '—';
      return u.attendanceRate !== null ? `${u.attendanceRate.toFixed(1)}%` : 'No ses';
    });

    const rowData = [
      index + 1,
      student.admissionNumber,
      student.fullName,
      student.cohortName,
      student.programmeCode,
      ...unitValues,
      student.overallScore !== null ? `${student.overallScore.toFixed(1)}%` : '—',
      getAttendanceStandingLabel(student.standing),
      student.totalPresent,
      student.totalCompletedSessions,
    ];

    const row = worksheet.addRow(rowData);
    row.height = 20;
    row.alignment = { vertical: 'middle' };

    // Borders
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber === 1 || colNumber === 2 || colNumber > 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Highlight at-risk rows in soft light red
    if (student.standing === 'at_risk') {
      const overallColIndex = 6 + unitCols.length;
      row.getCell(overallColIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE4E6' },
      };
      row.getCell(overallColIndex).font = { bold: true, color: { argb: 'FFBE123C' } };
    }
  });

  // Set column widths
  worksheet.columns = [
    { width: 6 },  // S/No
    { width: 22 }, // Admission Number
    { width: 30 }, // Full Name
    { width: 20 }, // Cohort
    { width: 14 }, // Programme
    ...unitCols.map(() => ({ width: 15 })), // Unit columns
    { width: 22 }, // Overall Attendance
    { width: 20 }, // Standing
    { width: 16 }, // Sessions Present
    { width: 18 }, // Total Sessions Held
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Student-Attendance-Scorecard-${scorecard.academicPeriodName.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
