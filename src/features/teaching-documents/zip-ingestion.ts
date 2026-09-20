import { inflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import type {
  SeedWeeklyTopic,
  UnitCurriculumDefinition,
} from './curriculum-registry';
import { normalizeUnitCodeKey } from './curriculum-registry';

export interface ExtractedFileEntry {
  filename: string;
  buffer: Buffer;
}

/**
 * Robust zero-dependency ZIP archive unpacker using native Node.js zlib
 */
export function unpackZipBuffer(zipBuffer: Buffer): ExtractedFileEntry[] {
  const entries: ExtractedFileEntry[] = [];
  let offset = 0;

  while (offset + 30 <= zipBuffer.length) {
    // Check for Local File Header Signature: 0x04034b50 (PK\x03\x04)
    if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);

    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + fileNameLength;
    const filename = zipBuffer.toString('utf8', filenameStart, filenameEnd);

    const dataStart = filenameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > zipBuffer.length) {
      break;
    }

    const rawData = zipBuffer.subarray(dataStart, dataEnd);

    // Skip directories
    if (!filename.endsWith('/') && !filename.startsWith('__MACOSX/')) {
      let decompressedData: Buffer | null = null;
      try {
        if (compressionMethod === 0) {
          // Stored (no compression)
          decompressedData = Buffer.from(rawData);
        } else if (compressionMethod === 8) {
          // Deflated
          decompressedData = inflateRawSync(rawData);
        }
      } catch {
        decompressedData = null;
      }

      if (decompressedData) {
        entries.push({
          filename,
          buffer: decompressedData,
        });
      }
    }

    offset = dataEnd;
  }

  return entries;
}

/**
 * Converts mammoth's clean semantic HTML output into the same
 * tab/newline-delimited text shape parseCurriculumText() already expects
 * (rows separated by newlines, cells separated by tabs). Unlike parsing raw
 * OOXML directly, mammoth has already resolved merged cells, nested runs,
 * and producer-specific quirks into normalized <table>/<tr>/<td> markup, so
 * this conversion step is far less likely to scramble a weekly-schedule
 * table than pattern-matching the original word/document.xml.
 */
function htmlToStructuredText(html: string): string {
  return html
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Legacy zero-dependency fallback: strips word/document.xml with regexes.
 * Kept only as a last resort if mammoth itself throws (e.g. a corrupted or
 * non-standard .docx) — mammoth's structural parsing below should be
 * preferred for anything with real tables (weekly schedules).
 */
function extractTextFromDocxRaw(docxBuffer: Buffer): string {
  try {
    const docxEntries = unpackZipBuffer(docxBuffer);
    const documentXml = docxEntries.find((e) => e.filename === 'word/document.xml');
    if (!documentXml) return '';

    const xmlText = documentXml.buffer.toString('utf8');
    const cleaned = xmlText
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab[^>]*>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \f\v]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();

    return cleaned;
  } catch {
    return '';
  }
}

/**
 * Extracts text from a .docx file buffer using mammoth's real OOXML parser
 * (correctly resolves tables, merged cells, and producer quirks), then
 * flattens its HTML output into the tab/newline text shape the downstream
 * parseCurriculumText() expects. Falls back to a naive XML strip only if
 * mammoth itself fails to process the file.
 */
export async function extractTextFromDocx(docxBuffer: Buffer): Promise<string> {
  try {
    const mammoth = await import(/* webpackIgnore: true */ 'mammoth');
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const text = htmlToStructuredText(result.value);
    if (text.length > 0) return text;
    // Empty result (e.g. an unusual document body) — try the raw fallback
    // before giving up entirely.
    return extractTextFromDocxRaw(docxBuffer);
  } catch (err) {
    console.warn('mammoth DOCX extraction failed, falling back to raw XML strip:', err);
    return extractTextFromDocxRaw(docxBuffer);
  }
}

/**
 * Heuristically parses a raw curriculum text string into structured TVET definition
 */
export function parseCurriculumText(
  rawText: string,
  filename: string
): UnitCurriculumDefinition {
  // 1. Detect Unit Code: e.g. "CND 1101", "NUT 101", "CLIN 201", "CHN 2309"
  const codeRegex = /\b([A-Z]{2,6})\s*([0-9]{3,4}[A-Z]?)\b/i;
  const matchCode = rawText.match(codeRegex) || filename.match(codeRegex);
  const unitCode = matchCode ? `${matchCode[1].toUpperCase()} ${matchCode[2].toUpperCase()}` : filename.replace(/\.[^/.]+$/, '').toUpperCase();

  // 2. Detect Unit Name
  let unitName = '';
  const titleRegex = /(?:Unit\s*(?:Title|Name)?|Course\s*(?:Title|Name)?|Module\s*(?:Title|Name)?)\s*[:=-]\s*([^\n\r\t]+)/i;
  const matchTitle = rawText.match(titleRegex);

  if (matchTitle && matchTitle[1].trim()) {
    unitName = matchTitle[1].trim();
  } else {
    const firstLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 5 && !codeRegex.test(l));
    unitName = firstLines[0] || filename.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
  }

  // 3. Extract Learning Outcomes
  const learningOutcomes: string[] = [];
  const loRegex = /(?:Learning\s*Outcomes?|Objectives?|Competencies?)\s*[:=-]?\s*([\s\S]*?)(?:Weekly|Course\s*Content|Topics?|Evaluation|Assessment|References|$)/i;
  const loMatch = rawText.match(loRegex);
  if (loMatch && loMatch[1]) {
    const lines = loMatch[1].split('\n').map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter((l) => l.length > 10);
    learningOutcomes.push(...lines.slice(0, 6));
  }

  // 4. Extract Weekly Schedule from text lines or table rows
  const weeklySchedule: SeedWeeklyTopic[] = [];
  const lines = rawText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Case A: Tab-delimited row: "1\tTopic\tSubtopics..." or "Week 1\tTopic..."
    const tabParts = trimmed.split('\t').map((p) => p.trim()).filter(Boolean);
    if (tabParts.length >= 2) {
      const weekMatch = tabParts[0].match(/^(?:Week|Wk|Session)?\s*(\d{1,2})$/i);
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1], 10);
        if (weekNum >= 1 && weekNum <= 14) {
          weeklySchedule.push({
            weekNumber: weekNum,
            topicTitle: tabParts[1],
            subTopics: tabParts[2] ? [tabParts[2]] : [tabParts[1]],
            learningActivities: tabParts[3] || undefined,
            resourcesAndReferences: tabParts[4] || undefined,
            assessmentAndRemarks: tabParts[5] || undefined,
          });
          continue;
        }
      }
    }

    // Case B: Inline week prefix: "Week 1: Topic" or "Week 1 - Topic"
    const inlineMatch = trimmed.match(/^(?:Week|Wk|Session)\s*(\d{1,2})\s*[:.-]\s*(.+)$/i);
    if (inlineMatch) {
      const weekNum = parseInt(inlineMatch[1], 10);
      if (weekNum >= 1 && weekNum <= 14) {
        weeklySchedule.push({
          weekNumber: weekNum,
          topicTitle: inlineMatch[2].trim(),
          subTopics: [inlineMatch[2].trim()],
        });
      }
    }
  }

  return {
    unitCode,
    unitName,
    learningOutcomes: learningOutcomes.length > 0 ? learningOutcomes : undefined,
    weeklySchedule: weeklySchedule.length > 0 ? weeklySchedule : undefined,
  };
}

/**
 * Parses an Excel curriculum sheet (.xlsx)
 */
export async function parseCurriculumExcel(
  excelBuffer: Buffer,
  filename: string
): Promise<UnitCurriculumDefinition[]> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS buffer input
  await workbook.xlsx.load(excelBuffer);

  const results: UnitCurriculumDefinition[] = [];

  workbook.eachSheet((worksheet) => {
    let unitCode = '';
    let unitName = worksheet.name;
    const weeklySchedule: SeedWeeklyTopic[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header

      const col1 = String(row.getCell(1).value || '').trim();
      const col2 = String(row.getCell(2).value || '').trim();
      const col3 = String(row.getCell(3).value || '').trim();
      const col4 = String(row.getCell(4).value || '').trim();

      // Check if row has Unit Code or Week
      const weekNum = parseInt(col1.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 14 && col2) {
        weeklySchedule.push({
          weekNumber: weekNum,
          topicTitle: col2,
          subTopics: col3 ? [col3] : [col2],
          learningActivities: col4 || undefined,
        });
      }

      if (!unitCode) {
        const codeMatch = (col1 + ' ' + col2).match(/\b([A-Z]{2,6})\s*([0-9]{3,4})\b/i);
        if (codeMatch) {
          unitCode = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
        }
      }
    });

    if (weeklySchedule.length > 0 || unitCode) {
      results.push({
        unitCode: unitCode || filename.replace(/\.[^/.]+$/, '').toUpperCase(),
        unitName,
        weeklySchedule: weeklySchedule.length > 0 ? weeklySchedule : undefined,
      });
    }
  });

  return results;
}

/**
 * Supported institutional teaching document types this ingester can produce.
 * Must match public.teaching_document_templates.document_type in Postgres.
 */
export type IngestibleDocumentType = 'scheme_of_work' | 'course_outline';

/**
 * Detects which document type a file belongs to from its path/filename or
 * parent folder. Zips should ideally be organised as:
 *   /scheme_of_work/CHN2309.docx
 *   /course_outline/CHN2309.docx
 * Folder-based detection is checked first (unambiguous); filename keywords
 * are the fallback for flat zips.
 */
export function detectDocumentType(filename: string): IngestibleDocumentType | null {
  const lower = filename.toLowerCase();

  // Folder-based detection (preferred, unambiguous)
  if (lower.includes('scheme_of_work/') || lower.includes('scheme-of-work/') || lower.includes('/sow/')) {
    return 'scheme_of_work';
  }
  if (lower.includes('course_outline/') || lower.includes('course-outline/')) {
    return 'course_outline';
  }

  // Filename keyword fallback
  const hasScheme = /scheme[\s_-]*of[\s_-]*work|\bsow\b/.test(lower);
  const hasOutline = /course[\s_-]*outline|\boutline\b/.test(lower);

  if (hasScheme && !hasOutline) return 'scheme_of_work';
  if (hasOutline && !hasScheme) return 'course_outline';

  // Ambiguous or neither keyword present — caller must handle (flag for manual review)
  return null;
}

/**
 * Ingests and standardizes an entire ZIP archive of raw course outlines and schemes.
 * Each extracted unit is tagged with its actual documentType so a scheme-of-work
 * file and a course-outline file for the SAME unit code never overwrite each other,
 * and so downstream persistence saves each under its correct document type.
 */
export async function ingestCurriculumZipArchive(
  zipBuffer: Buffer
): Promise<{
  totalFilesProcessed: number;
  extractedUnits: UnitCurriculumDefinition[];
  unresolvedFiles: string[];
}> {
  const entries = unpackZipBuffer(zipBuffer);
  const unitsMap = new Map<string, UnitCurriculumDefinition>();
  const unresolvedFiles: string[] = [];

  const upsert = (parsed: UnitCurriculumDefinition, filename: string) => {
    const documentType = detectDocumentType(filename);
    if (!documentType) {
      // Don't guess — surface it so the HOD can assign it manually in the preview UI.
      unresolvedFiles.push(filename);
      return;
    }
    const key = `${normalizeUnitCodeKey(parsed.unitCode)}:${documentType}`;
    unitsMap.set(key, { ...parsed, documentType });
  };

  for (const entry of entries) {
    const ext = entry.filename.toLowerCase();

    if (ext.endsWith('.docx')) {
      const text = await extractTextFromDocx(entry.buffer);
      if (text.length > 20) {
        upsert(parseCurriculumText(text, entry.filename), entry.filename);
      }
    } else if (ext.endsWith('.xlsx')) {
      const excelUnits = await parseCurriculumExcel(entry.buffer, entry.filename);
      for (const eu of excelUnits) {
        upsert(eu, entry.filename);
      }
    } else if (ext.endsWith('.txt') || ext.endsWith('.json')) {
      const text = entry.buffer.toString('utf8');
      if (ext.endsWith('.json')) {
        try {
          const parsedJson = JSON.parse(text);
          if (parsedJson.unitCode) {
            upsert(parsedJson, entry.filename);
            continue;
          }
        } catch {
          // fallback to text parse
        }
      }
      upsert(parseCurriculumText(text, entry.filename), entry.filename);
    }
  }

  return {
    totalFilesProcessed: entries.length,
    extractedUnits: Array.from(unitsMap.values()),
    unresolvedFiles,
  };
}