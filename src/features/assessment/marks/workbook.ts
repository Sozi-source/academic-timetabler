import ExcelJS, { type CellValue } from 'exceljs';

export const ASSESSMENT_MARKS_TEMPLATE_VERSION = '1.1';
export const ASSESSMENT_MARKS_METADATA_SHEET = '_meta';
export const ASSESSMENT_MARKS_HEADER_ROW = 5;
export const ASSESSMENT_MARKS_FIRST_STUDENT_ROW = 6;

export interface WorkbookAssessmentContext {
  id: string;
  title: string;
  assessmentType: 'cat' | 'exam';
  maxMark: number;
  passMark: number;
  assessmentDate: string | null;
  departmentName: string;
  academicPeriodId: string;
  academicPeriodName: string;
  academicYear: number;
  unitId: string;
  unitCode: string;
  unitName: string;
  programmeCode: string;
  programmeName: string;
}

export interface WorkbookPopulationStudent {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  attendanceStatus: 'pending' | 'present' | 'absent';
  trainerName: string;
}

export interface ParsedWorkbookRow {
  sheetName: string;
  rowNumber: number;
  admissionNumber: string;
  componentMarks: Record<string, number | null>;
  uploadedAbsent: boolean;
  totalMark: number | null;
}

export interface ParsedAssessmentWorkbook {
  assessmentId: string;
  unitId: string;
  assessmentType: 'cat' | 'exam';
  sheets: Array<{ sheetName: string; cohortId: string; rows: ParsedWorkbookRow[] }>;
}

function safeSheetName(value: string, used: Set<string>) {
  const base = value.replace(/[\\/*?:\[\]]/g, '-').trim().slice(0, 31) || 'Cohort';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function normalizeCell(value: CellValue) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
  if (typeof value === 'object' && 'result' in value) return normalizeCell(value.result ?? '');
  return String(value);
}

function numericCell(value: CellValue): number | null {
  const normalized = normalizeCell(value);
  if (typeof normalized === 'number') return Number.isFinite(normalized) ? normalized : null;
  const text = String(normalized).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function styleInstitutionHeader(
  sheet: ExcelJS.Worksheet,
  context: WorkbookAssessmentContext,
  cohortName: string,
  trainerName: string,
) {
  const lastColumn = context.assessmentType === 'exam' ? 11 : 6;

  // Row 1: institutional identity.
  sheet.mergeCells(1, 1, 1, lastColumn);
  const school = sheet.getCell(1, 1);
  school.value = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';
  school.font = { bold: true, size: 12, color: { argb: 'FF173F3B' } };
  school.alignment = { horizontal: 'center', vertical: 'middle' };
  school.border = {};
  sheet.getRow(1).height = 21;

  // Row 2: current markbook stage.
  sheet.mergeCells(2, 1, 2, lastColumn);
  const label = sheet.getCell(2, 1);
  label.value = context.assessmentType === 'exam' ? 'FINAL EXAM MARKSHEET' : 'CAT MARKSHEET';
  label.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  label.alignment = { horizontal: 'center', vertical: 'middle' };
  label.border = {};
  sheet.getRow(2).height = 18;

  // Row 3: unit identity only — full width, no cramped label/value cells.
  sheet.mergeCells(3, 1, 3, lastColumn);
  const unit = sheet.getCell(3, 1);
  unit.value = `${context.unitCode} · ${context.unitName}`;
  unit.font = { bold: true, size: 10, color: { argb: 'FF172B2A' } };
  unit.alignment = { horizontal: 'left', vertical: 'middle' };
  unit.border = {};
  sheet.getRow(3).height = 19;

  // Row 4: one compact metadata band.
  // Labels and values stay on one line; there are no visible table borders.
  const metadataValue = (
    labelText: string,
    valueText: string,
  ): ExcelJS.CellRichTextValue => ({
    richText: [
      {
        text: `${labelText}: `,
        font: { bold: true, size: 9, color: { argb: 'FF2F706B' } },
      },
      {
        text: valueText,
        font: { bold: true, size: 9, color: { argb: 'FF172B2A' } },
      },
    ],
  });

  const trainer = trainerName?.trim() || 'Unassigned';

  if (lastColumn >= 11) {
    sheet.mergeCells(4, 1, 4, 3);
    sheet.getCell(4, 1).value = metadataValue('Cohort', cohortName);

    sheet.mergeCells(4, 4, 4, 7);
    sheet.getCell(4, 4).value = metadataValue('Academic Period', context.academicPeriodName);

    sheet.mergeCells(4, 8, 4, 11);
    sheet.getCell(4, 8).value = metadataValue('Trainer', trainer);

    for (const cellRef of ['A4', 'D4', 'H4']) {
      const cell = sheet.getCell(cellRef);
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      cell.border = {};
    }
  } else {
    sheet.mergeCells(4, 1, 4, 2);
    sheet.getCell(4, 1).value = metadataValue('Cohort', cohortName);

    sheet.mergeCells(4, 3, 4, 4);
    sheet.getCell(4, 3).value = metadataValue('Academic Period', context.academicPeriodName);

    sheet.mergeCells(4, 5, 4, 6);
    sheet.getCell(4, 5).value = metadataValue('Trainer', trainer);

    for (const cellRef of ['A4', 'C4', 'E4']) {
      const cell = sheet.getCell(cellRef);
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      cell.border = {};
    }
  }

  sheet.getRow(4).height = 19;
}

function headerStyle(row: ExcelJS.Row) {
  row.height = 38;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  // Keep the heading visually clean. Borders are reserved for actual student rows.
  row.eachCell((cell) => {
    cell.border = {};
  });
}

function bodyCellStyle(cell: ExcelJS.Cell) {
  cell.alignment = { vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'hair', color: { argb: 'FFD8E2E0' } },
    bottom: { style: 'hair', color: { argb: 'FFD8E2E0' } },
    left: { style: 'hair', color: { argb: 'FFD8E2E0' } },
    right: { style: 'hair', color: { argb: 'FFD8E2E0' } },
  };
}

function addCohortSummary(
  sheet: ExcelJS.Worksheet,
  firstStudentRow: number,
  lastStudentRow: number,
  assessmentType: 'cat' | 'exam',
  catMaxMark?: number,
) {
  const summaryRowNo = lastStudentRow + 2;
  const summary = sheet.getRow(summaryRowNo);
  summary.height = 22;

  if (assessmentType === 'exam') {
    // Mean score deliberately includes only fully completed numeric records:
    // Assignment, Presentation/Practical, RAT, CAT 1 and End-Term Exam.
    summary.getCell(1).value = 'COHORT MEAN SCORE';
    summary.getCell(2).value = {
      formula:
        `IFERROR(AVERAGE(FILTER(I${firstStudentRow}:I${lastStudentRow},` +
        `(ISNUMBER(D${firstStudentRow}:D${lastStudentRow}))*` +
        `(ISNUMBER(E${firstStudentRow}:E${lastStudentRow}))*` +
        `(ISNUMBER(F${firstStudentRow}:F${lastStudentRow}))*` +
        `(ISNUMBER(G${firstStudentRow}:G${lastStudentRow}))*` +
        `(ISNUMBER(H${firstStudentRow}:H${lastStudentRow})))),"")`,
    };
    summary.getCell(2).numFmt = '0.00';

    summary.getCell(4).value = 'MEAN GRADE';
    summary.getCell(5).value = {
      formula:
        `IF(NOT(ISNUMBER(B${summaryRowNo})),"",` +
        `IF(B${summaryRowNo}>=75,"A - DISTINCTION",` +
        `IF(B${summaryRowNo}>=65,"B - CREDIT",` +
        `IF(B${summaryRowNo}>=50,"C - SATISFACTORY",` +
        `IF(B${summaryRowNo}>=40,"D - PASS","E - FAIL")))))`,
    };
  } else {
    summary.getCell(1).value = 'COHORT MEAN SCORE';
    summary.getCell(2).value = {
      formula: `IFERROR(AVERAGE(FILTER(D${firstStudentRow}:D${lastStudentRow},ISNUMBER(D${firstStudentRow}:D${lastStudentRow}))),"")`,
    };
    summary.getCell(2).numFmt = '0.00';

    summary.getCell(4).value = 'MEAN GRADE';
    const maxMark = catMaxMark && catMaxMark > 0 ? catMaxMark : 100;
    summary.getCell(5).value = {
      formula:
        `IF(NOT(ISNUMBER(B${summaryRowNo})),"",` +
        `IF(B${summaryRowNo}/${maxMark}>=0.75,"A - DISTINCTION",` +
        `IF(B${summaryRowNo}/${maxMark}>=0.65,"B - CREDIT",` +
        `IF(B${summaryRowNo}/${maxMark}>=0.5,"C - SATISFACTORY",` +
        `IF(B${summaryRowNo}/${maxMark}>=0.4,"D - PASS","E - FAIL")))))`,
    };
  }

  for (const col of [1, 4]) {
    summary.getCell(col).font = { bold: true, size: 9, color: { argb: 'FF2F706B' } };
  }
  for (const col of [2, 5]) {
    summary.getCell(col).font = { bold: true, size: 9, color: { argb: 'FF172B2A' } };
  }
  summary.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {};
  });

  return summaryRowNo;
}

function protectIdentityAndFormulaCells(sheet: ExcelJS.Worksheet, firstRow: number, lastRow: number, assessmentType: 'cat' | 'exam') {
  for (let row = firstRow; row <= lastRow; row += 1) {
    sheet.getCell(row, 1).protection = { locked: true };
    sheet.getCell(row, 2).protection = { locked: true };
    sheet.getCell(row, 3).protection = { locked: true };
    if (assessmentType === 'exam') {
      for (const col of [9, 10, 11]) sheet.getCell(row, col).protection = { locked: true };
    } else {
      for (const col of [5, 6]) sheet.getCell(row, col).protection = { locked: true };
    }
  }
}

export async function buildAssessmentMarksWorkbook(context: WorkbookAssessmentContext, students: WorkbookPopulationStudent[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Management System';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const meta = workbook.addWorksheet(ASSESSMENT_MARKS_METADATA_SHEET, { state: 'veryHidden' });
  meta.addRows([
    ['template_key', 'assessment-unit-marks'],
    ['template_version', ASSESSMENT_MARKS_TEMPLATE_VERSION],
    ['assessment_id', context.id],
    ['unit_id', context.unitId],
    ['assessment_type', context.assessmentType],
    ['academic_period_id', context.academicPeriodId],
  ]);

  const groups = new Map<string, WorkbookPopulationStudent[]>();
  for (const student of students) {
    const list = groups.get(student.cohortId) ?? [];
    list.push(student);
    groups.set(student.cohortId, list);
  }

  const usedNames = new Set<string>();
  for (const [, cohortStudents] of groups) {
    const first = cohortStudents[0];
    const sheetName = safeSheetName(first.cohortName || first.cohortCode, usedNames);
    meta.addRow(['sheet', sheetName, first.cohortId, first.cohortCode]);
    const sheet = workbook.addWorksheet(sheetName, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });
    sheet.views = [{ state: 'frozen', ySplit: ASSESSMENT_MARKS_HEADER_ROW }];
    styleInstitutionHeader(sheet, context, first.cohortName, first.trainerName);

    if (context.assessmentType === 'exam') {
      const headers = [
        'S/No.', 'Admn No.', "Student's Name", 'Assignments /5', 'Presentations / Practicals /10',
        'RAT /15', 'CAT 1 /15', 'End Term Exam /70', 'Total /100', 'Grade', 'Comment',
      ];
      sheet.getRow(ASSESSMENT_MARKS_HEADER_ROW).values = headers;
      headerStyle(sheet.getRow(ASSESSMENT_MARKS_HEADER_ROW));
      cohortStudents.forEach((student, index) => {
        const rowNo = ASSESSMENT_MARKS_FIRST_STUDENT_ROW + index;
        const row = sheet.getRow(rowNo);
        row.values = [index + 1, student.admissionNumber, student.fullName, null, null, null, null, student.attendanceStatus === 'absent' ? 'AB' : null, null, null, null];
        row.height = 21;
        for (let col = 1; col <= 11; col += 1) bodyCellStyle(row.getCell(col));
        for (const col of [4, 5, 6, 7]) row.getCell(col).protection = { locked: false };
        row.getCell(4).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 5], allowBlank: true, showErrorMessage: true, error: 'Enter a mark from 0 to 5.' };
        row.getCell(5).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 10], allowBlank: true, showErrorMessage: true, error: 'Enter a mark from 0 to 10.' };
        row.getCell(6).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 15], allowBlank: true, showErrorMessage: true, error: 'Enter a mark from 0 to 15.' };
        row.getCell(7).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 15], allowBlank: true, showErrorMessage: true, error: 'Enter a mark from 0 to 15.' };
        if (student.attendanceStatus !== 'absent') {
          row.getCell(8).protection = { locked: false };
          row.getCell(8).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 70], allowBlank: false, showErrorMessage: true, error: 'Enter an exam mark from 0 to 70.' };
        }
        // RAT/CAT average and coursework remain intentionally invisible. Total uses the same logic directly.
        row.getCell(9).value = { formula: `IF(H${rowNo}="AB","AB",IF(OR(H${rowNo}="",COUNT(F${rowNo}:G${rowNo})=0),"",SUM(D${rowNo}:E${rowNo})+AVERAGE(F${rowNo}:G${rowNo})+H${rowNo}))` };
        row.getCell(10).value = { formula: `IF(NOT(ISNUMBER(I${rowNo})),"",IF(I${rowNo}>=75,"A",IF(I${rowNo}>=65,"B",IF(I${rowNo}>=50,"C",IF(I${rowNo}>=40,"D","E")))))` };
        row.getCell(11).value = { formula: `IF(H${rowNo}="AB","ABSENT",IF(NOT(ISNUMBER(I${rowNo})),"",IF(I${rowNo}>=75,"DISTINCTION",IF(I${rowNo}>=65,"CREDIT",IF(I${rowNo}>=50,"SATISFACTORY",IF(I${rowNo}>=40,"PASS","FAIL")))))` };
        if (student.attendanceStatus === 'absent') row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E5' } };
      });
      const lastStudentRow = ASSESSMENT_MARKS_FIRST_STUDENT_ROW + cohortStudents.length - 1;
      sheet.columns = [7, 20, 34, 14, 20, 11, 11, 18, 14, 9, 16].map((width) => ({ width }));
      protectIdentityAndFormulaCells(sheet, ASSESSMENT_MARKS_FIRST_STUDENT_ROW, lastStudentRow, 'exam');
      addCohortSummary(sheet, ASSESSMENT_MARKS_FIRST_STUDENT_ROW, lastStudentRow, 'exam');
    } else {
      const headers = ['S/No.', 'Admn No.', "Student's Name", `${context.title} /${context.maxMark}`, 'GRADE', 'COMMENT'];
      sheet.getRow(ASSESSMENT_MARKS_HEADER_ROW).values = headers;
      headerStyle(sheet.getRow(ASSESSMENT_MARKS_HEADER_ROW));
      cohortStudents.forEach((student, index) => {
        const rowNo = ASSESSMENT_MARKS_FIRST_STUDENT_ROW + index;
        const row = sheet.getRow(rowNo);
        row.values = [index + 1, student.admissionNumber, student.fullName, student.attendanceStatus === 'absent' ? 'AB' : null, null, null];
        row.height = 22;
        for (let col = 1; col <= 6; col += 1) bodyCellStyle(row.getCell(col));
        if (student.attendanceStatus !== 'absent') {
          row.getCell(4).protection = { locked: false };
          row.getCell(4).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, context.maxMark], allowBlank: false, showErrorMessage: true, error: `Enter a mark from 0 to ${context.maxMark}.` };
        }
        row.getCell(5).value = { formula: `IF(D${rowNo}="AB","",IF(NOT(ISNUMBER(D${rowNo})),"",IF(D${rowNo}/${context.maxMark}>=0.75,"A",IF(D${rowNo}/${context.maxMark}>=0.65,"B",IF(D${rowNo}/${context.maxMark}>=0.5,"C",IF(D${rowNo}/${context.maxMark}>=0.4,"D","E")))))` };
        row.getCell(6).value = { formula: `IF(D${rowNo}="AB","ABSENT",IF(NOT(ISNUMBER(D${rowNo})),"",IF(D${rowNo}>=${context.passMark},"PASS","FAIL")))` };
        if (student.attendanceStatus === 'absent') row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E5' } };
      });
      const lastStudentRow = ASSESSMENT_MARKS_FIRST_STUDENT_ROW + cohortStudents.length - 1;
      sheet.columns = [7, 22, 36, 18, 10, 14].map((width) => ({ width }));
      protectIdentityAndFormulaCells(sheet, ASSESSMENT_MARKS_FIRST_STUDENT_ROW, lastStudentRow, 'cat');
      addCohortSummary(sheet, ASSESSMENT_MARKS_FIRST_STUDENT_ROW, lastStudentRow, 'cat', context.maxMark);
    }

    sheet.autoFilter = {
      from: { row: ASSESSMENT_MARKS_HEADER_ROW, column: 1 },
      to: { row: ASSESSMENT_MARKS_HEADER_ROW, column: context.assessmentType === 'exam' ? 11 : 6 },
    };
    await sheet.protect(`ams-${context.id.slice(0, 8)}`, {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      insertRows: false,
      deleteRows: false,
      sort: false,
      autoFilter: true,
    });
  }

  return workbook;
}

export async function parseAssessmentMarksWorkbook(buffer: Buffer | ArrayBuffer): Promise<ParsedAssessmentWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const workbookInput = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await workbook.xlsx.load(
    workbookInput as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const meta = workbook.getWorksheet(ASSESSMENT_MARKS_METADATA_SHEET);
  if (!meta) throw new Error('This is not a system-generated assessment marks workbook.');

  const metadata = new Map<string, string>();
  const sheetCohorts = new Map<string, string>();
  meta.eachRow((row) => {
    const key = String(normalizeCell(row.getCell(1).value)).trim();
    if (key === 'sheet') {
      const sheetName = String(normalizeCell(row.getCell(2).value)).trim();
      const cohortId = String(normalizeCell(row.getCell(3).value)).trim();
      if (sheetName && cohortId) sheetCohorts.set(sheetName, cohortId);
      return;
    }
    const value = String(normalizeCell(row.getCell(2).value)).trim();
    if (key) metadata.set(key, value);
  });

  if (metadata.get('template_key') !== 'assessment-unit-marks' || metadata.get('template_version') !== ASSESSMENT_MARKS_TEMPLATE_VERSION) {
    throw new Error('The marks workbook template is not supported. Download a fresh workbook from the system.');
  }
  const assessmentType = metadata.get('assessment_type');
  if (assessmentType !== 'cat' && assessmentType !== 'exam') throw new Error('Assessment type metadata is invalid.');

  const sheets: ParsedAssessmentWorkbook['sheets'] = [];
  for (const [sheetName, cohortId] of sheetCohorts) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Expected worksheet "${sheetName}" is missing.`);
    const rows: ParsedWorkbookRow[] = [];
    for (let rowNo = ASSESSMENT_MARKS_FIRST_STUDENT_ROW; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      const admissionNumber = String(normalizeCell(row.getCell(2).value)).trim().toUpperCase();
      if (!admissionNumber) continue;
      if (assessmentType === 'exam') {
        const examRaw = String(normalizeCell(row.getCell(8).value)).trim().toUpperCase();
        const assignment = numericCell(row.getCell(4).value);
        const presentation = numericCell(row.getCell(5).value);
        const rat = numericCell(row.getCell(6).value);
        const cat1 = numericCell(row.getCell(7).value);
        const exam = examRaw === 'AB' ? null : numericCell(row.getCell(8).value);
        const ratCatAverage = rat === null && cat1 === null ? null : ((rat ?? 0) + (cat1 ?? 0)) / ((rat !== null ? 1 : 0) + (cat1 !== null ? 1 : 0));
        const coursework = assignment === null && presentation === null && ratCatAverage === null ? null : (assignment ?? 0) + (presentation ?? 0) + (ratCatAverage ?? 0);
        const total = examRaw === 'AB' || coursework === null || exam === null ? null : coursework + exam;
        rows.push({
          sheetName,
          rowNumber: rowNo,
          admissionNumber,
          componentMarks: { assignment, presentation, rat, cat1, ratCatAverage, coursework, exam },
          uploadedAbsent: examRaw === 'AB',
          totalMark: total,
        });
      } else {
        const raw = String(normalizeCell(row.getCell(4).value)).trim().toUpperCase();
        const mark = raw === 'AB' ? null : numericCell(row.getCell(4).value);
        rows.push({ sheetName, rowNumber: rowNo, admissionNumber, componentMarks: { mark }, uploadedAbsent: raw === 'AB', totalMark: mark });
      }
    }
    sheets.push({ sheetName, cohortId, rows });
  }

  return {
    assessmentId: metadata.get('assessment_id') ?? '',
    unitId: metadata.get('unit_id') ?? '',
    assessmentType,
    sheets,
  };
}

export function gradeFor(total: number | null, maxMark: number) {
  if (total === null || maxMark <= 0) return null;
  const percent = (total / maxMark) * 100;
  if (percent >= 75) return 'A';
  if (percent >= 65) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 40) return 'D';
  return 'E';
}
