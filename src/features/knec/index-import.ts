import type { SupabaseClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

export interface ParsedKnecIndexRow {
  admissionNumber: string;
  knecIndexNumber: string;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
  }
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

export async function parseKnecIndexImportFile(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  filename: string,
): Promise<ParsedKnecIndexRow[]> {
  const lower = filename.toLowerCase();
  const rows: string[][] = [];

  if (lower.endsWith('.csv')) {
    const text = Buffer.isBuffer(buffer)
      ? buffer.toString('utf8')
      : Buffer.from(new Uint8Array(buffer)).toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      rows.push(splitCsvLine(line));
    }
  } else {
    const wb = new ExcelJS.Workbook();
    const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer));
    await wb.xlsx.load(nodeBuf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    for (let r = 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const cells = Array.from({ length: ws.columnCount }, (_, idx) =>
        cellToString(row.getCell(idx + 1).value),
      );
      if (cells.some(Boolean)) rows.push(cells);
    }
  }

  if (rows.length < 2) return [];

  // Detect header row cleanly (supports optional title rows above the header)
  let headerRowIdx = 0;
  let admCol = -1;
  let indexCol = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
    const a = findColumnIndex(rows[i], ['admissionno', 'admissionnumber', 'admno']);
    const k = findColumnIndex(rows[i], ['knecindexnumber', 'knecindex', 'indexnumber', 'indexno']);
    if (a !== -1 && k !== -1) {
      headerRowIdx = i;
      admCol = a;
      indexCol = k;
      break;
    }
  }

  // Positional fallback for simple 2-column CSV/sheet (Admission No, KNEC Index No)
  if (admCol === -1 || indexCol === -1) {
    if ((rows[0]?.length ?? 0) >= 2) {
      headerRowIdx = 0;
      admCol = 0;
      indexCol = 1;
    } else {
      return [];
    }
  }

  const deduped = new Map<string, ParsedKnecIndexRow>();
  for (let r = headerRowIdx + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const admissionNumber = (row[admCol] ?? '').trim();
    const knecIndexNumber = (row[indexCol] ?? '').trim();
    if (!admissionNumber || !knecIndexNumber) continue;
    deduped.set(admissionNumber.toLowerCase(), {
      admissionNumber,
      knecIndexNumber,
    });
  }

  return Array.from(deduped.values());
}

export interface BulkKnecIndexUpdateResult {
  totalRows: number;
  matchedStudents: number;
  updatedBookings: number;
  unmatchedAdmissionNumbers: string[];
}

export async function applyBulkKnecIndexNumbers(params: {
  admin: SupabaseClient;
  departmentId: string;
  entries: ParsedKnecIndexRow[];
  seriesId?: string | null;
  markBookingsRegistered?: boolean;
  actorId?: string | null;
}): Promise<BulkKnecIndexUpdateResult> {
  const {
    admin,
    departmentId,
    entries,
    seriesId = null,
    markBookingsRegistered = true,
    actorId = null,
  } = params;

  const { data: students, error: stuErr } = await admin
    .from('students')
    .select('id, admission_number')
    .eq('department_id', departmentId);

  if (stuErr) {
    throw new Error(`Unable to load students: ${stuErr.message}`);
  }

  const studentIdByAdm = new Map<string, string>();
  for (const s of students ?? []) {
    studentIdByAdm.set(String(s.admission_number).trim().toLowerCase(), String(s.id));
  }

  const unmatchedAdmissionNumbers: string[] = [];
  const matchedEntries: Array<{ studentId: string; knecIndexNumber: string }> = [];

  for (const entry of entries) {
    const studentId = studentIdByAdm.get(entry.admissionNumber.trim().toLowerCase());
    if (!studentId) {
      unmatchedAdmissionNumbers.push(entry.admissionNumber);
      continue;
    }
    matchedEntries.push({
      studentId,
      knecIndexNumber: entry.knecIndexNumber.trim(),
    });
  }

  if (matchedEntries.length === 0) {
    return {
      totalRows: entries.length,
      matchedStudents: 0,
      updatedBookings: 0,
      unmatchedAdmissionNumbers,
    };
  }

  const now = new Date().toISOString();
  let updatedBookings = 0;

  for (const item of matchedEntries) {
    const { error: uStuErr } = await admin
      .from('students')
      .update({ knec_index_number: item.knecIndexNumber })
      .eq('id', item.studentId)
      .eq('department_id', departmentId);

    if (uStuErr) {
      throw new Error(`Failed updating student index number: ${uStuErr.message}`);
    }

    await admin
      .from('student_knec_module_statuses')
      .update({ knec_index_number: item.knecIndexNumber, updated_at: now })
      .eq('student_id', item.studentId)
      .eq('department_id', departmentId);

    let bookingQuery = admin
      .from('student_knec_bookings')
      .update({
        knec_index_number: item.knecIndexNumber,
        updated_at: now,
        ...(markBookingsRegistered
          ? {
              booking_status: 'registered_knec',
              hod_cleared_at: now,
              ...(actorId ? { hod_cleared_by: actorId } : {}),
            }
          : {}),
      })
      .eq('student_id', item.studentId)
      .eq('department_id', departmentId)
      .neq('booking_status', 'cancelled');

    if (seriesId && seriesId !== 'all') {
      bookingQuery = bookingQuery.eq('series_id', seriesId);
    }

    const { data: updatedRows, error: bErr } = await bookingQuery.select('id');
    if (bErr) {
      throw new Error(`Failed updating booking KNEC index: ${bErr.message}`);
    }
    updatedBookings += updatedRows?.length ?? 0;
  }

  return {
    totalRows: entries.length,
    matchedStudents: matchedEntries.length,
    updatedBookings,
    unmatchedAdmissionNumbers,
  };
}
