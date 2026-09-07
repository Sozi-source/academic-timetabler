import ExcelJS from 'exceljs';
import type { RawReportingRow } from './types';

/**
 * Normalizes any Google Sheets URL into a direct CSV export endpoint.
 * Supports:
 * - https://docs.google.com/spreadsheets/d/{id}/edit#gid={gid}
 * - https://docs.google.com/spreadsheets/d/{id}/view
 * - https://docs.google.com/spreadsheets/d/e/{pub_id}/pubhtml
 * - https://docs.google.com/spreadsheets/d/e/{pub_id}/pub
 */
export function resolveGoogleSheetCsvUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed.includes('docs.google.com/spreadsheets')) {
    throw new Error('Please enter a valid Google Sheets link (from docs.google.com/spreadsheets).');
  }

  // Handle Published to Web format (/d/e/.../pub or /pubhtml)
  const pubMatch = trimmed.match(/\/d\/e\/([a-zA-Z0-9-_]+)\/(pubhtml|pub)/);
  if (pubMatch) {
    const pubId = pubMatch[1];
    const gidMatch = trimmed.match(/[#?&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv&gid=${gid}`;
  }

  // Handle standard document format (/d/.../edit or /view)
  const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error('Could not identify the Google Spreadsheet ID in the provided URL.');
  }

  const sheetId = idMatch[1];
  const gidMatch = trimmed.match(/[#?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Fetches and parses a public/link-shared Google Sheet into raw rows.
 */
export async function fetchGoogleSheetRows(sheetUrl: string): Promise<RawReportingRow[]> {
  const csvUrl = resolveGoogleSheetCsvUrl(sheetUrl);

  let response: Response;
  try {
    response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/csv, text/plain, */*',
      },
      cache: 'no-store',
    });
  } catch (err) {
    throw new Error(`Failed to connect to Google Sheets: ${err instanceof Error ? err.message : 'Network error'}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Google Sheet not found. Please check that the URL is correct.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Access denied: This Google Sheet is private. In Google Sheets, click "Share" and change General Access to "Anyone with the link can view".',
      );
    }
    throw new Error(`Google Sheets responded with HTTP status ${response.status}.`);
  }

  // Check if Google redirected to a login page
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('text/html') && (text.includes('ServiceLogin') || text.includes('accounts.google.com'))) {
    throw new Error(
      'Access denied: The Google Sheet requires Google Account login. In Google Sheets, click "Share" and ensure General Access is set to "Anyone with the link can view".',
    );
  }

  return parseCsvText(text);
}

/**
 * Matches column headers for admission numbers.
 */
function isAdmissionHeader(header: string): boolean {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'admissionnumber',
    'admissionno',
    'admission',
    'admno',
    'admnumber',
    'regno',
    'registrationno',
    'registrationnumber',
    'studentid',
    'studentno',
    'studentnumber',
  ].includes(normalized);
}

/**
 * Matches column headers for reporting dates.
 */
function isDateHeader(header: string): boolean {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'date',
    'reporteddate',
    'reportingdate',
    'reportedon',
    'datereported',
    'reportdate',
  ].includes(normalized);
}

/**
 * Parses raw CSV text into reporting rows with intelligent header and pattern recognition.
 */
export function parseCsvText(csvText: string): RawReportingRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  // Parse CSV line handling quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const parsedLines = lines.map(parseLine);
  if (parsedLines.length === 0) return [];

  // Check if first line contains headers
  const headerLine = parsedLines[0];
  let admColIdx = headerLine.findIndex(isAdmissionHeader);
  let dateColIdx = headerLine.findIndex(isDateHeader);
  let startIndex = 1;

  if (admColIdx === -1) {
    // If no header matches, test if row 0 itself looks like an admission number
    // Typical admission number contains '/' e.g. "CHN/S-4184/IC/24" or "DNDT/2026/001"
    const hasSlash = headerLine.some((col) => col.includes('/'));
    if (hasSlash) {
      admColIdx = headerLine.findIndex((col) => col.includes('/'));
      startIndex = 0; // Row 0 is data
    } else {
      // Default to first column
      admColIdx = 0;
      startIndex = 1;
    }
  }

  const rows: RawReportingRow[] = [];
  for (let i = startIndex; i < parsedLines.length; i++) {
    const cols = parsedLines[i];
    const rawAdm = cols[admColIdx];
    if (!rawAdm || rawAdm.length < 3) continue;

    // Filter out repeated header lines
    if (isAdmissionHeader(rawAdm)) continue;

    const rawDate = dateColIdx !== -1 ? cols[dateColIdx] : null;
    rows.push({
      admissionNumber: rawAdm.trim(),
      reportedOn: rawDate?.trim() || null,
      sourceRowNumber: i + 1,
    });
  }

  return rows;
}

/**
 * Parses an Excel (.xlsx / .xls) buffer into reporting rows.
 */
export async function parseWorkbookBuffer(buffer: ArrayBuffer | Buffer): Promise<RawReportingRow[]> {
  const workbook = new ExcelJS.Workbook();
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const workbookInput = nodeBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookInput);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rawRows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let val = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          val = String(cell.value.text ?? '');
        } else if (cell.value instanceof Date) {
          val = cell.value.toISOString().split('T')[0];
        } else {
          val = String(cell.value);
        }
      }
      values.push(val.trim());
    });
    if (values.some((v) => v.length > 0)) {
      rawRows.push(values);
    }
  });

  if (rawRows.length === 0) return [];

  const headerRow = rawRows[0];
  let admColIdx = headerRow.findIndex(isAdmissionHeader);
  let dateColIdx = headerRow.findIndex(isDateHeader);
  let startIndex = 1;

  if (admColIdx === -1) {
    const hasSlash = headerRow.some((col) => col.includes('/'));
    if (hasSlash) {
      admColIdx = headerRow.findIndex((col) => col.includes('/'));
      startIndex = 0;
    } else {
      admColIdx = 0;
      startIndex = 1;
    }
  }

  const rows: RawReportingRow[] = [];
  for (let i = startIndex; i < rawRows.length; i++) {
    const cols = rawRows[i];
    const rawAdm = cols[admColIdx];
    if (!rawAdm || rawAdm.length < 3) continue;
    if (isAdmissionHeader(rawAdm)) continue;

    const rawDate = dateColIdx !== -1 ? cols[dateColIdx] : null;
    rows.push({
      admissionNumber: rawAdm.trim(),
      reportedOn: rawDate?.trim() || null,
      sourceRowNumber: i + 1,
    });
  }

  return rows;
}

/**
 * Parses raw text copied and pasted from spreadsheets or tables.
 * Handles newline-separated or tab-separated inputs.
 */
export function parsePastedText(text: string): RawReportingRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const rows: RawReportingRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If tab-delimited (copied from multi-column Excel/Sheets)
    if (line.includes('\t')) {
      const cols = line.split('\t').map((c) => c.trim());
      // Find column containing '/' (common admission number structure) or first non-empty column
      const admCol = cols.find((c) => c.includes('/') && c.length >= 4) || cols[0];
      if (admCol && !isAdmissionHeader(admCol)) {
        rows.push({
          admissionNumber: admCol,
          sourceRowNumber: i + 1,
        });
      }
      continue;
    }

    // If comma-delimited
    if (line.includes(',')) {
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const admCol = cols.find((c) => c.includes('/') && c.length >= 4) || cols[0];
      if (admCol && !isAdmissionHeader(admCol)) {
        rows.push({
          admissionNumber: admCol,
          sourceRowNumber: i + 1,
        });
      }
      continue;
    }

    // Single column list of admission numbers
    if (line.length >= 3 && !isAdmissionHeader(line)) {
      rows.push({
        admissionNumber: line,
        sourceRowNumber: i + 1,
      });
    }
  }

  return rows;
}
