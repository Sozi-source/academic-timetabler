import ExcelJS, { type CellValue } from 'exceljs';

export interface ParsedRawMarkRow {
  sheetName: string;
  rowNumber: number;
  admissionNumber: string;
  fullName?: string;
  assignment: number | null;
  presentation: number | null;
  rat: number | null;
  cat: number | null;
  exam: number | null;
  isAbsent: boolean;
  totalMark: number | null;
}

export interface StudentRosterCandidate {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus?: 'expected' | 'absent';
}

export interface MatchedBulkStudentResult {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  assignment: number | null;
  presentation: number | null;
  rat: number | null;
  cat: number | null;
  exam: number | null;
  ratCatAverage: number | null;
  courseworkTotal: number | null;
  finalTotal: number | null;
  attendanceStatus: 'expected' | 'absent';
  warnings: string[];
}

export interface UnmatchedBulkRow {
  sheetName: string;
  rowNumber: number;
  admissionNumber: string;
  fullName?: string;
  reason: string;
}

export interface MissingBulkStudent {
  studentId: string;
  admissionNumber: string;
  fullName: string;
}

export interface BulkMarksValidationSummary {
  totalRowsRead: number;
  matchedCount: number;
  unmatchedCount: number;
  missingCount: number;
  errorCount: number;
  matched: MatchedBulkStudentResult[];
  unmatched: UnmatchedBulkRow[];
  missing: MissingBulkStudent[];
  errors: string[];
}

function normalizeCellValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return normalizeCellValue(value.result ?? '');
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((chunk) => chunk.text || '').join('').trim();
    }
  }
  return String(value).trim();
}

function numericCellValue(value: CellValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && 'result' in value) {
    return numericCellValue(value.result ?? null);
  }
  const text = normalizeCellValue(value);
  if (!text) return null;
  if (/^(ab|absent|a\/b|dna)$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function isAbsentValue(value: CellValue): boolean {
  const text = normalizeCellValue(value).toLowerCase();
  return text === 'ab' || text === 'absent' || text === 'a/b' || text === 'dna';
}

interface ColumnMap {
  admissionCol: number;
  nameCol: number | null;
  attendanceCol: number | null;
  assignmentCol: number | null;
  presentationCol: number | null;
  ratCol: number | null;
  catCol: number | null;
  examCol: number | null;
  totalCol: number | null;
}

function detectColumns(sheet: ExcelJS.Worksheet): { headerRowNumber: number; columns: ColumnMap } | null {
  const maxScanRows = Math.min(sheet.rowCount, 20);

  for (let rowNo = 1; rowNo <= maxScanRows; rowNo += 1) {
    const row = sheet.getRow(rowNo);
    let admissionCol: number | null = null;
    let nameCol: number | null = null;
    let attendanceCol: number | null = null;
    let assignmentCol: number | null = null;
    let presentationCol: number | null = null;
    let ratCol: number | null = null;
    let catCol: number | null = null;
    let examCol: number | null = null;
    let totalCol: number | null = null;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const headerText = normalizeCellValue(cell.value).toLowerCase().replace(/[\r\n\t_]/g, ' ');

      if (!admissionCol && (headerText.includes('admission') || headerText.includes('admn') || headerText.includes('adm no') || headerText.includes('reg no') || headerText.includes('reg. no') || headerText.includes('registration'))) {
        admissionCol = colNumber;
      } else if (!nameCol && (headerText.includes('student name') || headerText.includes("student's name") || headerText.includes('full name') || headerText === 'name')) {
        nameCol = colNumber;
      } else if (!attendanceCol && (headerText.includes('attendance') || headerText.includes('exam status'))) {
        attendanceCol = colNumber;
      } else if (!assignmentCol && (headerText.includes('assignment') || headerText.startsWith('assig') || headerText.startsWith('asmt'))) {
        assignmentCol = colNumber;
      } else if (!presentationCol && (headerText.includes('presentation') || headerText.startsWith('pres'))) {
        presentationCol = colNumber;
      } else if (!ratCol && (headerText.includes('rat') && !headerText.includes('rat/cat') && !headerText.includes('cat/rat'))) {
        ratCol = colNumber;
      } else if (!catCol && (headerText.includes('cat') && !headerText.includes('rat/cat') && !headerText.includes('cat/rat'))) {
        catCol = colNumber;
      } else if (!examCol && (headerText.includes('exam') || headerText.includes('theory'))) {
        examCol = colNumber;
      } else if (!totalCol && (headerText.includes('total') || headerText.includes('final /100') || headerText.includes('final mark'))) {
        totalCol = colNumber;
      }
    });

    if (admissionCol !== null) {
      return {
        headerRowNumber: rowNo,
        columns: {
          admissionCol,
          nameCol,
          attendanceCol,
          assignmentCol,
          presentationCol,
          ratCol,
          catCol,
          examCol,
          totalCol,
        },
      };
    }
  }

  return null;
}

export async function parseBulkMarksSpreadsheet(
  buffer: Buffer | ArrayBuffer,
): Promise<ParsedRawMarkRow[]> {
  const workbook = new ExcelJS.Workbook();
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  try {
    await workbook.xlsx.load(
      inputBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch (xlsxError) {
    // Attempt CSV reading if XLSX load failed
    try {
      const csvString = inputBuffer.toString('utf-8');
      const { Readable } = await import('stream');
      const csvStream = Readable.from([csvString]);
      await workbook.csv.read(csvStream);
    } catch {
      throw new Error('Could not parse the marks spreadsheet. Please ensure it is a valid .xlsx or .csv file.');
    }
  }

  const rawRows: ParsedRawMarkRow[] = [];

  for (const sheet of workbook.worksheets) {
    // Skip hidden or metadata sheets
    if (sheet.state === 'hidden' || sheet.state === 'veryHidden') continue;
    if (sheet.name.startsWith('_')) continue;

    const detected = detectColumns(sheet);
    if (!detected) continue;

    const { headerRowNumber, columns } = detected;

    for (let rowNo = headerRowNumber + 1; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      const admissionRaw = normalizeCellValue(row.getCell(columns.admissionCol).value);
      if (!admissionRaw) continue;

      // Skip summary / average rows
      const admissionLower = admissionRaw.toLowerCase();
      if (
        admissionLower.includes('average') ||
        admissionLower.includes('total') ||
        admissionLower.includes('mean') ||
        admissionLower.includes('generated') ||
        admissionLower.includes('signature')
      ) {
        continue;
      }

      const admissionNumber = admissionRaw.toUpperCase();
      const fullName = columns.nameCol ? normalizeCellValue(row.getCell(columns.nameCol).value) : undefined;
      const attendanceRaw = columns.attendanceCol ? row.getCell(columns.attendanceCol).value : null;
      const examRaw = columns.examCol ? row.getCell(columns.examCol).value : null;

      const isAbsent = isAbsentValue(attendanceRaw) || isAbsentValue(examRaw);

      const assignment = columns.assignmentCol ? numericCellValue(row.getCell(columns.assignmentCol).value) : null;
      const presentation = columns.presentationCol ? numericCellValue(row.getCell(columns.presentationCol).value) : null;
      const rat = columns.ratCol ? numericCellValue(row.getCell(columns.ratCol).value) : null;
      const cat = columns.catCol ? numericCellValue(row.getCell(columns.catCol).value) : null;
      const exam = isAbsent ? null : (columns.examCol ? numericCellValue(examRaw) : null);
      const totalMark = columns.totalCol ? numericCellValue(row.getCell(columns.totalCol).value) : null;

      rawRows.push({
        sheetName: sheet.name,
        rowNumber: rowNo,
        admissionNumber,
        fullName,
        assignment,
        presentation,
        rat,
        cat,
        exam,
        isAbsent,
        totalMark,
      });
    }
  }

  if (rawRows.length === 0) {
    throw new Error(
      'No student mark rows could be found. Please verify the spreadsheet includes an "Admission Number" column header.',
    );
  }

  return rawRows;
}

export function matchAndValidateBulkMarks(
  rawRows: ParsedRawMarkRow[],
  roster: StudentRosterCandidate[],
): BulkMarksValidationSummary {
  const rosterMap = new Map<string, StudentRosterCandidate>();
  for (const student of roster) {
    rosterMap.set(student.admissionNumber.trim().toUpperCase(), student);
  }

  const matched: MatchedBulkStudentResult[] = [];
  const unmatched: UnmatchedBulkRow[] = [];
  const errors: string[] = [];
  const processedStudentIds = new Set<string>();

  for (const row of rawRows) {
    const student = rosterMap.get(row.admissionNumber);

    if (!student) {
      unmatched.push({
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        admissionNumber: row.admissionNumber,
        fullName: row.fullName,
        reason: 'Student admission number is not registered in this unit roster.',
      });
      continue;
    }

    if (processedStudentIds.has(student.studentId)) {
      unmatched.push({
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        admissionNumber: row.admissionNumber,
        fullName: row.fullName,
        reason: 'Duplicate row found for this student in the spreadsheet.',
      });
      continue;
    }

    processedStudentIds.add(student.studentId);
    const warnings: string[] = [];

    // Component validation
    if (row.assignment !== null) {
      if (row.assignment < 0 || row.assignment > 5) {
        errors.push(`${student.admissionNumber}: Assignment mark (${row.assignment}) must be between 0 and 5.`);
      }
    }
    if (row.presentation !== null) {
      if (row.presentation < 0 || row.presentation > 10) {
        errors.push(`${student.admissionNumber}: Presentation mark (${row.presentation}) must be between 0 and 10.`);
      }
    }
    if (row.rat !== null) {
      if (row.rat < 0 || row.rat > 15) {
        errors.push(`${student.admissionNumber}: RAT mark (${row.rat}) must be between 0 and 15.`);
      }
    }
    if (row.cat !== null) {
      if (row.cat < 0 || row.cat > 15) {
        errors.push(`${student.admissionNumber}: CAT mark (${row.cat}) must be between 0 and 15.`);
      }
    }
    if (row.exam !== null) {
      if (row.exam < 0 || row.exam > 70) {
        errors.push(`${student.admissionNumber}: Exam mark (${row.exam}) must be between 0 and 70.`);
      }
    }

    // Calculations
    const ratCatAverage =
      row.rat === null && row.cat === null
        ? null
        : Math.round((((row.rat ?? 0) + (row.cat ?? 0)) / ((row.rat !== null ? 1 : 0) + (row.cat !== null ? 1 : 0))) * 100) / 100;

    const courseworkTotal =
      row.assignment === null && row.presentation === null && ratCatAverage === null
        ? null
        : Math.round(((row.assignment ?? 0) + (row.presentation ?? 0) + (ratCatAverage ?? 0)) * 100) / 100;

    const finalTotal =
      row.isAbsent
        ? null
        : courseworkTotal !== null && row.exam !== null
          ? Math.round((courseworkTotal + row.exam) * 100) / 100
          : row.totalMark !== null
            ? row.totalMark
            : null;

    matched.push({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      assignment: row.assignment,
      presentation: row.presentation,
      rat: row.rat,
      cat: row.cat,
      exam: row.isAbsent ? null : row.exam,
      ratCatAverage,
      courseworkTotal,
      finalTotal,
      attendanceStatus: row.isAbsent ? 'absent' : (student.attendanceStatus ?? 'expected'),
      warnings,
    });
  }

  const missing: MissingBulkStudent[] = [];
  for (const student of roster) {
    if (!processedStudentIds.has(student.studentId)) {
      missing.push({
        studentId: student.studentId,
        admissionNumber: student.admissionNumber,
        fullName: student.fullName,
      });
    }
  }

  return {
    totalRowsRead: rawRows.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    missingCount: missing.length,
    errorCount: errors.length,
    matched,
    unmatched,
    missing,
    errors,
  };
}
