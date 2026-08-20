import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { getAssessmentWorkbookData, refreshUnitMarkbookPopulation } from '@/features/assessment/marks/server-data';

function safeName(value: string, used: Set<string>) {
  const base = value.replace(/[\\/*?:\[\]]/g, '-').trim().slice(0, 31) || 'Cohort';
  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export async function GET(_request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  let data = await getAssessmentWorkbookData(assessmentId);
  if (!data) return NextResponse.json({ message: 'Unit markbook not found.' }, { status: 404 });

  if (data.students.length === 0) {
    const refreshed = await refreshUnitMarkbookPopulation(assessmentId);
    if (!refreshed.ok) return NextResponse.json({ message: refreshed.message }, { status: 409 });
    data = await getAssessmentWorkbookData(assessmentId);
  }

  if (!data || data.students.length === 0) {
    return NextResponse.json(
      { message: 'The unit population could not be built. Verify student unit registrations for this academic period.' },
      { status: 409 },
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  const grouped = new Map<string, typeof data.students>();
  for (const student of data.students) {
    const list = grouped.get(student.cohortId) ?? [];
    list.push(student);
    grouped.set(student.cohortId, list);
  }
  const used = new Set<string>();
  for (const [, students] of grouped) {
    const first = students[0];
    const sheet = workbook.addWorksheet(safeName(first.cohortName, used));
    // Keep generated attendance workbooks on Excel's most conservative OOXML path.
    // Print scaling and frozen panes are intentionally avoided here because some
    // desktop Excel builds attempt to repair files containing those combinations.
    sheet.pageSetup.orientation = 'portrait';
    sheet.pageSetup.paperSize = 9;
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';
    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = data.context.assessmentType === 'exam' ? 'EXAM ATTENDANCE SIGNING SHEET' : 'CAT ATTENDANCE SIGNING SHEET';
    sheet.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF173F3B' } };
    sheet.getCell('A2').font = { bold: true, size: 11, color: { argb: 'FF173F3B' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.addRow([]);
    sheet.addRow(['Unit', `${data.context.unitCode} · ${data.context.unitName}`, 'Cohort', first.cohortName]);
    sheet.addRow(['Period', data.context.academicPeriodName, 'Date', data.context.assessmentDate ?? '']);
    sheet.addRow([]);
    const header = sheet.addRow(['S/No.', 'Admission No.', 'Student Name', 'Signature']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    students.forEach((student, index) => {
      const row = sheet.addRow([index + 1, student.admissionNumber, student.fullName, '']);
      row.height = 25;
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    sheet.columns = [{ width: 8 }, { width: 24 }, { width: 38 }, { width: 28 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${data.context.unitCode}-${data.context.assessmentType}-attendance.xlsx`.replace(/[^A-Za-z0-9._-]+/g, '-');
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
