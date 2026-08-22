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
 * Extracts plain text from a .docx file buffer
 */
export function extractTextFromDocx(docxBuffer: Buffer): string {
  try {
    const docxEntries = unpackZipBuffer(docxBuffer);
    const documentXml = docxEntries.find((e) => e.filename === 'word/document.xml');
    if (!documentXml) return '';

    const xmlText = documentXml.buffer.toString('utf8');
    // Extract text inside <w:t> tags and paragraph breaks
    const cleaned = xmlText
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:tab[^>]*>/g, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();

    return cleaned;
  } catch {
    return '';
  }
}

/**
 * Heuristically parses a raw curriculum text string into structured TVET definition
 */
export function parseCurriculumText(
  rawText: string,
  filename: string
): UnitCurriculumDefinition {
  // 1. Detect Unit Code: e.g. "CND 1101", "NUT 101", "CLIN 201"
  const codeRegex = /\b([A-Z]{2,6})\s*([0-9]{3,4}[A-Z]?)\b/i;
  const matchCode = rawText.match(codeRegex) || filename.match(codeRegex);
  const unitCode = matchCode ? `${matchCode[1].toUpperCase()} ${matchCode[2].toUpperCase()}` : filename.replace(/\.[^/.]+$/, '').toUpperCase();

  // 2. Detect Unit Name
  let unitName = '';
  const titleRegex = /(?:Unit\s*(?:Title|Name)?|Course\s*(?:Title|Name)?|Module\s*(?:Title|Name)?)\s*[:=-]\s*([^\n\r]+)/i;
  const matchTitle = rawText.match(titleRegex);

  if (matchTitle && matchTitle[1].trim()) {
    unitName = matchTitle[1].trim();
  } else {
    // Try first prominent line of text or clean filename
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

  // 4. Extract Weekly Schedule
  const weeklySchedule: SeedWeeklyTopic[] = [];
  const weekMatches = [...rawText.matchAll(/(?:Week|Wk|Session)\s*(\d+)\s*[:.-]?\s*([^\n\r]+)/gi)];

  if (weekMatches.length > 0) {
    for (const m of weekMatches) {
      const weekNum = Number(m[1]);
      if (weekNum >= 1 && weekNum <= 14) {
        weeklySchedule.push({
          weekNumber: weekNum,
          topicTitle: m[2].trim(),
          subTopics: [m[2].trim()],
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
 * Ingests and standardizes an entire ZIP archive of raw course outlines and schemes
 */
export async function ingestCurriculumZipArchive(
  zipBuffer: Buffer
): Promise<{
  totalFilesProcessed: number;
  extractedUnits: UnitCurriculumDefinition[];
}> {
  const entries = unpackZipBuffer(zipBuffer);
  const unitsMap = new Map<string, UnitCurriculumDefinition>();

  for (const entry of entries) {
    const ext = entry.filename.toLowerCase();

    if (ext.endsWith('.docx')) {
      const text = extractTextFromDocx(entry.buffer);
      if (text.length > 20) {
        const parsed = parseCurriculumText(text, entry.filename);
        const key = normalizeUnitCodeKey(parsed.unitCode);
        unitsMap.set(key, parsed);
      }
    } else if (ext.endsWith('.xlsx')) {
      const excelUnits = await parseCurriculumExcel(entry.buffer, entry.filename);
      for (const eu of excelUnits) {
        const key = normalizeUnitCodeKey(eu.unitCode);
        unitsMap.set(key, eu);
      }
    } else if (ext.endsWith('.txt') || ext.endsWith('.json')) {
      const text = entry.buffer.toString('utf8');
      if (ext.endsWith('.json')) {
        try {
          const parsedJson = JSON.parse(text);
          if (parsedJson.unitCode) {
            const key = normalizeUnitCodeKey(parsedJson.unitCode);
            unitsMap.set(key, parsedJson);
            continue;
          }
        } catch {
          // fallback to text parse
        }
      }
      const parsed = parseCurriculumText(text, entry.filename);
      const key = normalizeUnitCodeKey(parsed.unitCode);
      unitsMap.set(key, parsed);
    }
  }

  return {
    totalFilesProcessed: entries.length,
    extractedUnits: Array.from(unitsMap.values()),
  };
}
