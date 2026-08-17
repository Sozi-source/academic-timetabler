import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { getAssessmentAnalysis } from '@/features/assessment/analysis/queries';
import { requireHodAccess } from '@/features/auth/authorization';

function safeFile(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function formatSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  sheet.columns.forEach((column, index) => { column.width = widths[index] ?? 16; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } };
}

export async function GET(_request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  await requireHodAccess();
  const { assessmentId } = await params;
  const analysis = await getAssessmentAnalysis(assessmentId);
  if (!analysis) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Management System';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.addRows([
    ['Assessment', `${analysis.event.unit?.code ?? ''} ${analysis.event.unit?.name ?? ''} · ${analysis.event.title}`.trim()],
    ['Academic period', analysis.event.academic_period?.name ?? ''],
    ['Type', analysis.event.assessment_type.toUpperCase()],
    ['Expected', analysis.expected],
    ['Present', analysis.present],
    ['Absent', analysis.absent],
    ['Marked', analysis.marked],
    ['Missing marks', analysis.missingMarks],
    ['Passed', analysis.passed],
    ['Failed', analysis.failed],
    ['Pass rate', analysis.passRate === null ? '' : analysis.passRate / 100],
    ['Mean', analysis.mean ?? ''],
    ['Highest', analysis.highest ?? ''],
    ['Lowest', analysis.lowest ?? ''],
    ['Coursework mean', analysis.courseworkMean ?? ''],
    ['Exam mean', analysis.examMean ?? ''],
  ]);
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 42;
  summary.getColumn(1).font = { bold: true };
  summary.getCell('B11').numFmt = '0.0%';

  const cohorts = workbook.addWorksheet('By Cohort');
  cohorts.addRow(['Cohort', 'Expected', 'Present', 'Absent', 'Marked', 'Missing Marks', 'Pass', 'Fail', 'Mean']);
  for (const row of analysis.cohorts) cohorts.addRow([row.cohortName || row.cohortCode, row.expected, row.present, row.absent, row.marked, row.missingMarks, row.passed, row.failed, row.mean ?? '']);
  formatSheet(cohorts, [28, 12, 12, 12, 12, 15, 10, 10, 12]);

  const students = workbook.addWorksheet('Student Results');
  students.addRow(['Admission Number', 'Student Name', 'Cohort', 'Attendance', 'Total Mark', 'Grade', 'Comment']);
  for (const student of analysis.students) students.addRow([student.admissionNumber, student.fullName, student.cohortName || student.cohortCode, student.attendanceStatus, student.attendanceStatus === 'absent' ? 'AB' : student.totalMark ?? '', student.grade ?? '', student.comment ?? '']);
  formatSheet(students, [24, 34, 28, 14, 14, 10, 18]);

  const output = await workbook.xlsx.writeBuffer();
  const fileName = safeFile(`${analysis.event.unit?.code ?? 'unit'}-${analysis.event.title}-analysis.xlsx`);
  return new NextResponse(new Uint8Array(output), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
