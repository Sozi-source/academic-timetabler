import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { getNextSemesterAttachmentData } from '@/features/students/attachment-eligibility';

const exportRowSchema = z.object({
  admissionNumber: z.string(),
  fullName: z.string(),
  programmeCode: z.string(),
  cohortName: z.string(),
  currentStageCode: z.string(),
  attachmentStageCode: z.string(),
  attachmentUnitCode: z.string(),
  attachmentUnitName: z.string(),
  source: z.enum(['auto', 'manual']),
  notes: z.string().optional(),
});

const exportPayloadSchema = z.object({
  rows: z.array(exportRowSchema).min(1).max(1000),
});

type ExportRow = z.infer<typeof exportRowSchema>;

async function buildWorkbookBuffer(departmentName: string, rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Timetabler & Department Management';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attachment Eligibility', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Institutional header
  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';
  sheet.getCell('A1').font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells('A2:J2');
  sheet.getCell('A2').value = `NEXT SEMESTER INDUSTRIAL ATTACHMENT LIST — ${(departmentName || 'DEPARTMENT').toUpperCase()}`;
  sheet.getCell('A2').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F6E56' } };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  sheet.mergeCells('A3:J3');
  sheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  Total Approved Students: ${rows.length}`;
  sheet.getCell('A3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 18;

  sheet.getRow(4).height = 8;

  const headers = [
    'No.',
    'Admission No.',
    'Student Full Name',
    'Programme',
    'Cohort',
    'Current Stage',
    'Attachment Stage',
    'Attachment Unit',
    'Selection Source',
    'Notes / Flags',
  ];

  const headerRow = sheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E56' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow([
      index + 1,
      row.admissionNumber,
      row.fullName,
      row.programmeCode,
      row.cohortName,
      row.currentStageCode,
      row.attachmentStageCode,
      `${row.attachmentUnitCode} ${row.attachmentUnitName}`.trim(),
      row.source === 'manual' ? 'Manual Override' : 'Curriculum Auto',
      row.notes ?? '',
    ]);
    excelRow.height = 20;
    const isEven = index % 2 === 1;
    excelRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.alignment = {
        horizontal: [1, 4, 6, 7, 9].includes(colNumber) ? 'center' : 'left',
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  sheet.columns = [
    { width: 6 },
    { width: 20 },
    { width: 32 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 38 },
    { width: 16 },
    { width: 28 },
  ];

  // Summary worksheet grouped by Programme & Cohort
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Programme', 'Cohort', 'Attachment Stage', 'Attachment Unit', 'Approved Students']);
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.height = 22;
  summaryHeader.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E56' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const groupMap = new Map<string, { programme: string; cohort: string; stage: string; unit: string; count: number }>();
  for (const r of rows) {
    const key = `${r.programmeCode}|${r.cohortName}|${r.attachmentStageCode}|${r.attachmentUnitCode}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(key, {
        programme: r.programmeCode,
        cohort: r.cohortName,
        stage: r.attachmentStageCode,
        unit: `${r.attachmentUnitCode} ${r.attachmentUnitName}`.trim(),
        count: 1,
      });
    }
  }

  for (const g of groupMap.values()) {
    summarySheet.addRow([g.programme, g.cohort, g.stage, g.unit, g.count]);
  }
  const totalRow = summarySheet.addRow(['TOTAL', '', '', '', rows.length]);
  totalRow.font = { name: 'Calibri', size: 10, bold: true };
  summarySheet.columns = [{ width: 14 }, { width: 20 }, { width: 16 }, { width: 40 }, { width: 18 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function GET() {
  await requireHodAccess();
  const data = await getNextSemesterAttachmentData();
  const rows: ExportRow[] = data.candidates.map((c) => {
    const flags: string[] = [];
    if (c.isTransferStudent) flags.push('Transfer student');
    if (c.referredUnitCount > 0) flags.push(`${c.referredUnitCount} referred unit(s)`);
    return {
      admissionNumber: c.admissionNumber,
      fullName: c.fullName,
      programmeCode: c.programmeCode,
      cohortName: c.cohortName,
      currentStageCode: c.currentStageCode,
      attachmentStageCode: c.attachmentStageCode,
      attachmentUnitCode: c.attachmentUnitCode,
      attachmentUnitName: c.attachmentUnitName,
      source: c.source,
      notes: flags.join('; '),
    };
  });

  const buffer = await buildWorkbookBuffer(data.departmentName, rows);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Next_Semester_Attachment_List.xlsx"',
    },
  });
}

export async function POST(request: Request) {
  const profile = await requireHodAccess();
  const body = await request.json().catch(() => null);
  const parsed = exportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || 'No approved students selected for export.' },
      { status: 400 },
    );
  }

  const buffer = await buildWorkbookBuffer(profile.departmentName, parsed.data.rows);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Next_Semester_Attachment_List.xlsx"',
    },
  });
}
