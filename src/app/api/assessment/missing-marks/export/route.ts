import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';

interface ExportRecordPayload {
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortName: string;
  unitCode: string;
  unitName: string;
  catDisplay: string;
  examDisplay: string;
  notes: string;
}

export async function POST(request: Request) {
  try {
    const profile = await requireHodAccess();
    const body = (await request.json()) as {
      periodName?: string;
      rows?: ExportRecordPayload[];
    };

    const rows = Array.isArray(body.rows) ? body.rows : [];
    const periodName = body.periodName || 'Active Period';
    const departmentName = profile.departmentName || 'Department';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academic Planner';
    workbook.created = new Date();

    // Sheet 1: Student Summary (Grouped)
    const summarySheet = workbook.addWorksheet('Student Summary');
    summarySheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Admission No.', key: 'admissionNumber', width: 20 },
      { header: 'Student Full Name', key: 'fullName', width: 32 },
      { header: 'Programme', key: 'programmeCode', width: 12 },
      { header: 'Cohort', key: 'cohortName', width: 20 },
      { header: 'Flagged Units', key: 'unitCount', width: 14 },
      { header: 'Units & Status', key: 'details', width: 52 },
    ];

    summarySheet.spliceRows(1, 0,
      ['IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES'],
      [`MISSING MARKS & ABSENCES REGISTER — ${departmentName.toUpperCase()} (${periodName})`],
      [`Generated: ${new Date().toLocaleDateString('en-KE')} · Total Records: ${rows.length}`],
      [],
    );

    summarySheet.mergeCells('A1:G1');
    summarySheet.mergeCells('A2:G2');
    summarySheet.mergeCells('A3:G3');
    summarySheet.getCell('A1').font = { bold: true, size: 13 };
    summarySheet.getCell('A2').font = { bold: true, size: 11 };
    summarySheet.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF475569' } };

    const summaryHeaderRow = summarySheet.getRow(5);
    summaryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF033B36' } };

    const byStudent = new Map<string, {
      admissionNumber: string;
      fullName: string;
      programmeCode: string;
      cohortName: string;
      items: string[];
    }>();

    for (const r of rows) {
      const existing = byStudent.get(r.admissionNumber);
      const tag = `${r.unitCode} (CAT: ${r.catDisplay}, Exam: ${r.examDisplay})`;
      if (!existing) {
        byStudent.set(r.admissionNumber, {
          admissionNumber: r.admissionNumber,
          fullName: r.fullName,
          programmeCode: r.programmeCode,
          cohortName: r.cohortName,
          items: [tag],
        });
      } else {
        existing.items.push(tag);
      }
    }

    let studentIdx = 1;
    for (const s of byStudent.values()) {
      summarySheet.addRow({
        no: studentIdx++,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
        programmeCode: s.programmeCode,
        cohortName: s.cohortName,
        unitCount: s.items.length,
        details: s.items.join('; '),
      });
    }

    // Sheet 2: Detailed Unit Records
    const detailSheet = workbook.addWorksheet('Detailed Records');
    detailSheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Admission No.', key: 'admissionNumber', width: 20 },
      { header: 'Student Full Name', key: 'fullName', width: 32 },
      { header: 'Programme', key: 'programmeCode', width: 12 },
      { header: 'Cohort', key: 'cohortName', width: 20 },
      { header: 'Unit Code', key: 'unitCode', width: 14 },
      { header: 'Unit Name', key: 'unitName', width: 34 },
      { header: 'CAT Status', key: 'catDisplay', width: 14 },
      { header: 'Exam Status', key: 'examDisplay', width: 14 },
      { header: 'Notes / Reason', key: 'notes', width: 30 },
    ];

    const detailHeaderRow = detailSheet.getRow(1);
    detailHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF033B36' } };

    rows.forEach((r, idx) => {
      detailSheet.addRow({
        no: idx + 1,
        admissionNumber: r.admissionNumber,
        fullName: r.fullName,
        programmeCode: r.programmeCode,
        cohortName: r.cohortName,
        unitCode: r.unitCode,
        unitName: r.unitName,
        catDisplay: r.catDisplay,
        examDisplay: r.examDisplay,
        notes: r.notes,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safePeriod = periodName.replace(/[^a-zA-Z0-9_-]+/g, '_');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="missing-marks-absences-${safePeriod}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export missing marks report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
