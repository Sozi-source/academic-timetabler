import ExcelJS from 'exceljs';
import { unpackZipBuffer } from './zip-ingestion';
import { parseDocxSyllabus } from './curriculum-editor/docx-parser';
import { normalizeUnitCodeKey } from './curriculum-registry';
import { hasTopicCoverageContamination } from './topic-coverage-validation';
import { stripTopicFigures } from './distribution-engine';
import {
  inferCurriculumDocumentType,
  type CurriculumDocumentType,
} from './curriculum-document-types';

export interface BulkTopicItem {
  sequence: number;
  topic: string;
  coverage: string;
  hours?: number;
  learningOutcomes?: string;
  activities?: string;
  assessment?: string;
  resources?: string;
}

export interface BulkCourseOutlineUnit {
  documentType: CurriculumDocumentType;
  unitCode: string;
  unitName: string;
  matchedUnitId: string | null;
  matchedUnitCode: string | null;
  matchedUnitName: string | null;
  status: 'matched' | 'unmatched';
  unitDescription?: string;
  coreLearningOutcomes?: string;
  teachingLearningApproaches?: string;
  assessmentApproaches?: string;
  references?: string;
  topics: BulkTopicItem[];
}

export interface SystemUnitLookup {
  id: string;
  code: string;
  name: string;
}

export interface BulkParseResult {
  ok: boolean;
  error?: string;
  fileName: string;
  fileType: 'xlsx' | 'zip';
  totalUnits: number;
  matchedCount: number;
  unmatchedCount: number;
  units: BulkCourseOutlineUnit[];
  issues: Array<{ severity: 'warning' | 'info' | 'error'; message: string }>;
}

function cleanCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && 'text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).text ?? '').trim();
  }
  if (typeof val === 'object' && 'richText' in (val as Record<string, unknown>)) {
    const rt = (val as { richText: Array<{ text: string }> }).richText;
    return rt.map((p) => p.text).join('').trim();
  }
  return String(val).trim();
}

function normalizeHeaderStr(val: unknown): string {
  return cleanCell(val)
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type WorkbookSheetRole = 'units' | 'topics';

function inferWorkbookSheetRole(sheet: ExcelJS.Worksheet): WorkbookSheetRole | null {
  const sheetName = normalizeHeaderStr(sheet.name);
  const mentionsUnits = /\bunits?\b|\boverview\b|\bdetails?\b/.test(sheetName);
  const mentionsTopics = /\btopics?\b|\bcontent\b|\bschedule\b|\bsyllabus\b/.test(sheetName);

  if (mentionsTopics && !mentionsUnits) return 'topics';
  if (mentionsUnits && !mentionsTopics) return 'units';

  for (let rowIndex = 1; rowIndex <= Math.min(6, sheet.rowCount); rowIndex++) {
    let hasUnitCode = false;
    let hasUnitName = false;
    let hasTopic = false;
    let hasCoverage = false;

    sheet.getRow(rowIndex).eachCell((cell) => {
      const header = normalizeHeaderStr(cell.value);
      if (header.includes('unit code') || header === 'code' || header === 'unit') hasUnitCode = true;
      if (header.includes('unit name') || header === 'name') hasUnitName = true;
      if (header.includes('subtopic') || header.includes('sub topic') || header.includes('coverage') || header.includes('content')) {
        hasCoverage = true;
      } else if (header.includes('topic') || header.includes('session') || header.includes('theme')) {
        hasTopic = true;
      }
    });

    if (hasUnitCode && (hasTopic || hasCoverage)) return 'topics';
    if (hasUnitCode && hasUnitName) return 'units';
  }

  return mentionsUnits ? 'units' : mentionsTopics ? 'topics' : null;
}

/**
 * Parses an Excel (.xlsx) file containing multiple units and topic schedules
 */
export async function parseBulkCourseOutlineWorkbook(
  buffer: Buffer,
  fileName: string,
  systemUnits: SystemUnitLookup[],
): Promise<BulkParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const unitsMap = new Map<string, BulkCourseOutlineUnit>();
  const issues: Array<{ severity: 'warning' | 'info' | 'error'; message: string }> = [];

  // Helper to get or create a unit entry in unitsMap by normalized code
  const getOrCreateUnit = (
    documentType: CurriculumDocumentType,
    rawCode: string,
    rawName?: string,
  ): BulkCourseOutlineUnit => {
    const key = `${documentType}:${normalizeUnitCodeKey(rawCode)}`;
    let existing = unitsMap.get(key);
    if (!existing) {
      existing = {
        documentType,
        unitCode: rawCode.trim().toUpperCase(),
        unitName: rawName?.trim() || rawCode.trim().toUpperCase(),
        matchedUnitId: null,
        matchedUnitCode: null,
        matchedUnitName: null,
        status: 'unmatched',
        topics: [],
      };
      unitsMap.set(key, existing);
    } else if (rawName && (!existing.unitName || existing.unitName === existing.unitCode)) {
      existing.unitName = rawName.trim();
    }
    return existing;
  };

  const sheetsByType: Record<CurriculumDocumentType, { units: ExcelJS.Worksheet[]; topics: ExcelJS.Worksheet[] }> = {
    course_outline: { units: [], topics: [] },
    scheme_of_work: { units: [], topics: [] },
  };
  const untypedRecognizedSheets: ExcelJS.Worksheet[] = [];
  const explicitlyTypedSheets: ExcelJS.Worksheet[] = [];

  workbook.eachSheet((sheet) => {
    const role = inferWorkbookSheetRole(sheet);
    if (!role) {
      if (sheet.actualRowCount > 0) {
        issues.push({
          severity: 'warning',
          message: `Sheet "${sheet.name}" was skipped because its curriculum document type or sheet role could not be identified.`,
        });
      }
      return;
    }

    const explicitlyTyped = /scheme|course\s*outline/i.test(sheet.name);
    const documentType = inferCurriculumDocumentType(sheet.name);
    sheetsByType[documentType][role].push(sheet);
    if (explicitlyTyped) explicitlyTypedSheets.push(sheet);
    else untypedRecognizedSheets.push(sheet);
  });

  if (explicitlyTypedSheets.some((sheet) => inferCurriculumDocumentType(sheet.name) === 'scheme_of_work')) {
    for (const sheet of untypedRecognizedSheets) {
      issues.push({
        severity: 'warning',
        message: `Sheet "${sheet.name}" does not name a document type; it was treated as Course Outline for backward compatibility.`,
      });
    }
  }

  // 2. Parse Units Sheet
  for (const documentType of ['course_outline', 'scheme_of_work'] as const) {
    for (const unitsSheet of sheetsByType[documentType].units) {
      let headerRowIdx = 1;
      let colMap: Record<string, number> = {};

      // Scan top 6 rows for header
      for (let r = 1; r <= Math.min(6, unitsSheet.rowCount); r++) {
        const row = unitsSheet.getRow(r);
        const rowCols: Record<string, number> = {};
        row.eachCell((cell, colNumber) => {
          const h = normalizeHeaderStr(cell.value);
          if (h.includes('unit code') || h === 'code' || h === 'unit') rowCols.unit_code = colNumber;
          if (h.includes('unit name') || h === 'name' || (h.includes('title') && !h.includes('topic'))) rowCols.unit_name = colNumber;
          if (h.includes('description') || h.includes('purpose') || h.includes('overview')) rowCols.description = colNumber;
          if (h.includes('outcome') || h.includes('competenc') || h.includes('objective')) rowCols.outcomes = colNumber;
          if (h.includes('teaching') || h.includes('approach') || h.includes('method')) rowCols.approaches = colNumber;
          if (h.includes('assessment') || h.includes('weight')) rowCols.assessment = colNumber;
          if (h.includes('reference') || h.includes('resource') || h.includes('book')) rowCols.references = colNumber;
        });

        if (rowCols.unit_code) {
          headerRowIdx = r;
          colMap = rowCols;
          break;
        }
      }

      if (colMap.unit_code) {
        for (let r = headerRowIdx + 1; r <= unitsSheet.rowCount; r++) {
          const row = unitsSheet.getRow(r);
          const code = cleanCell(row.getCell(colMap.unit_code).value);
          if (!code || code.toLowerCase().includes('unit code')) continue;

          const name = colMap.unit_name ? cleanCell(row.getCell(colMap.unit_name).value) : '';
          const unit = getOrCreateUnit(documentType, code, name);

          if (colMap.description) {
            const desc = cleanCell(row.getCell(colMap.description).value);
            if (desc) unit.unitDescription = desc;
          }
          if (colMap.outcomes) {
            const out = cleanCell(row.getCell(colMap.outcomes).value);
            if (out) unit.coreLearningOutcomes = out;
          }
          if (colMap.approaches) {
            const app = cleanCell(row.getCell(colMap.approaches).value);
            if (app) unit.teachingLearningApproaches = app;
          }
          if (colMap.assessment) {
            const ass = cleanCell(row.getCell(colMap.assessment).value);
            if (ass) unit.assessmentApproaches = ass;
          }
          if (colMap.references) {
            const ref = cleanCell(row.getCell(colMap.references).value);
            if (ref) unit.references = ref;
          }
        }
      }
    }
  }

  // 3. Parse Topics / Content Sheet
  for (const documentType of ['course_outline', 'scheme_of_work'] as const) {
    for (const topicsSheet of sheetsByType[documentType].topics) {
      let headerRowIdx = 1;
      let colMap: Record<string, number> = {};

      for (let r = 1; r <= Math.min(6, topicsSheet.rowCount); r++) {
        const row = topicsSheet.getRow(r);
        const rowCols: Record<string, number> = {};
        row.eachCell((cell, colNumber) => {
          const h = normalizeHeaderStr(cell.value);
          if (h.includes('unit code') || h === 'code' || h === 'unit') rowCols.unit_code = colNumber;
          if (h.includes('unit name') || h === 'name' || (h.includes('title') && !h.includes('topic'))) rowCols.unit_name = colNumber;
          if (h.includes('seq') || h.includes('week') || h.includes('order')) rowCols.sequence = colNumber;
          const isSubtopic = h.includes('subtopic') || h.includes('sub topic') || h.includes('sub-topic') || h.includes('coverage') || h.includes('content');
          if (isSubtopic) {
            rowCols.coverage = colNumber;
          } else if (h.includes('topic') || h.includes('session') || h.includes('theme')) {
            rowCols.topic = colNumber;
          }
          if (h.includes('hour') || h.includes('duration') || h.includes('time')) rowCols.hours = colNumber;
          if (h.includes('resource') || h.includes('reference') || h.includes('book')) rowCols.resources = colNumber;
          if (h.includes('outcome') || h.includes('objective')) rowCols.outcomes = colNumber;
          if (h.includes('activit')) rowCols.activities = colNumber;
          if (h.includes('assessment')) rowCols.assessment = colNumber;
        });

        if (rowCols.unit_code && (rowCols.topic || rowCols.coverage)) {
          headerRowIdx = r;
          colMap = rowCols;
          break;
        }
      }

      if (colMap.unit_code && (colMap.topic || colMap.coverage)) {
        for (let r = headerRowIdx + 1; r <= topicsSheet.rowCount; r++) {
          const row = topicsSheet.getRow(r);
          const code = cleanCell(row.getCell(colMap.unit_code).value);
          if (!code || code.toLowerCase().includes('unit code')) continue;

          const name = colMap.unit_name ? cleanCell(row.getCell(colMap.unit_name).value) : undefined;
          const topicTitle = colMap.topic ? cleanCell(row.getCell(colMap.topic).value) : '';
          const coverage = colMap.coverage ? cleanCell(row.getCell(colMap.coverage).value) : '';

          if (!topicTitle && !coverage) continue;

          const unit = getOrCreateUnit(documentType, code, name);
          const seqVal = colMap.sequence ? Number(cleanCell(row.getCell(colMap.sequence).value)) : NaN;
          const sequence = !isNaN(seqVal) && seqVal > 0 ? seqVal : unit.topics.length + 1;

          const hoursVal = colMap.hours ? Number(cleanCell(row.getCell(colMap.hours).value)) : undefined;

          unit.topics.push({
            sequence,
            topic: stripTopicFigures(topicTitle) || `Topic ${sequence}`,
            coverage: coverage ? stripTopicFigures(coverage) : (stripTopicFigures(topicTitle) || `Topic ${sequence}`),
            hours: !isNaN(hoursVal as number) ? hoursVal : undefined,
            learningOutcomes: colMap.outcomes ? cleanCell(row.getCell(colMap.outcomes).value) : undefined,
            activities: colMap.activities ? cleanCell(row.getCell(colMap.activities).value) : undefined,
            assessment: colMap.assessment ? cleanCell(row.getCell(colMap.assessment).value) : undefined,
            resources: colMap.resources ? cleanCell(row.getCell(colMap.resources).value) : undefined,
          });
        }
      }
    }
  }

  // 4. Match units against system registry
  const parsedUnits: BulkCourseOutlineUnit[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const unit of unitsMap.values()) {
    const key = normalizeUnitCodeKey(unit.unitCode);
    const normName = normalizeUnitCodeKey(unit.unitName);

    // Exact code match first
    let matched = systemUnits.find((su) => normalizeUnitCodeKey(su.code) === key);

    // Fallback: match by exact name
    if (!matched && normName) {
      matched = systemUnits.find((su) => normalizeUnitCodeKey(su.name) === normName);
    }

    if (matched) {
      unit.matchedUnitId = matched.id;
      unit.matchedUnitCode = matched.code;
      unit.matchedUnitName = matched.name;
      unit.status = 'matched';
      matchedCount++;
    } else {
      unit.status = 'unmatched';
      unmatchedCount++;
      issues.push({
        severity: 'warning',
        message: `Unit code "${unit.unitCode}" (${unit.unitName}) was not found in the active unit database.`,
      });
    }

    if (unit.topics.length === 0) {
      issues.push({
        severity: 'warning',
        message: `Unit "${unit.unitCode}" has no weekly topics listed in the Topics sheet.`,
      });
    }

    if (hasTopicCoverageContamination(unit.topics)) {
      issues.push({
        severity: 'error',
        message: `Unit "${unit.unitCode}" appears to have subtopic text mixed into its topic titles. Separate the topic heading from its coverage bullets before publishing.`,
      });
    }

    parsedUnits.push(unit);
  }

  return {
    ok: true,
    fileName,
    fileType: 'xlsx',
    totalUnits: parsedUnits.length,
    matchedCount,
    unmatchedCount,
    units: parsedUnits,
    issues,
  };
}

/**
 * Parses a ZIP archive containing individual Word (.docx) course outlines
 */
export async function parseBulkCourseOutlineZip(
  buffer: Buffer,
  fileName: string,
  systemUnits: SystemUnitLookup[],
): Promise<BulkParseResult> {
  const entries = unpackZipBuffer(buffer);
  const docxEntries = entries.filter(
    (e) => e.filename.toLowerCase().endsWith('.docx') && !e.filename.includes('__MACOSX'),
  );

  if (docxEntries.length === 0) {
    return {
      ok: false,
      error: 'No Word (.docx) documents found in the uploaded ZIP archive.',
      fileName,
      fileType: 'zip',
      totalUnits: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      units: [],
      issues: [{ severity: 'error', message: 'No valid .docx documents found inside ZIP.' }],
    };
  }

  const parsedUnits: BulkCourseOutlineUnit[] = [];
  const issues: Array<{ severity: 'warning' | 'info' | 'error'; message: string }> = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const entry of docxEntries) {
    try {
      const parsed = parseDocxSyllabus(entry.buffer);
      const baseFilename = entry.filename.split('/').pop()?.split('\\').pop() ?? entry.filename;
      const documentType = inferCurriculumDocumentType(`${baseFilename} ${parsed.unitName ?? ''}`);

      // Detect code from parsed result or filename
      let code = parsed.unitCode?.trim();
      if (!code) {
        const codeMatch = baseFilename.match(/\b([A-Z]{2,6})\s*([0-9]{3,4}[A-Z]?)\b/i);
        if (codeMatch) {
          code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
        } else {
          code = baseFilename.replace(/\.docx$/i, '').toUpperCase();
        }
      }

      let name = parsed.unitName?.trim() || baseFilename.replace(/\.docx$/i, '');

      const key = normalizeUnitCodeKey(code);
      const normName = normalizeUnitCodeKey(name);

      let matched = systemUnits.find((su) => normalizeUnitCodeKey(su.code) === key);
      if (!matched && normName) {
        matched = systemUnits.find((su) => normalizeUnitCodeKey(su.name) === normName);
      }

      const unit: BulkCourseOutlineUnit = {
        documentType,
        unitCode: code,
        unitName: name,
        matchedUnitId: matched?.id ?? null,
        matchedUnitCode: matched?.code ?? null,
        matchedUnitName: matched?.name ?? null,
        status: matched ? 'matched' : 'unmatched',
        unitDescription: parsed.unitDescription,
        coreLearningOutcomes: parsed.overallCompetencies,
        teachingLearningApproaches: 'Interactive lectures, guided class discussions, practical demonstrations.',
        assessmentApproaches: 'Continuous Assessment Tests (CATs) · Final Summative Examination',
        references: parsed.references,
        topics: parsed.topics.map((t, idx) => ({
          sequence: idx + 1,
          topic: t.topicTitle,
          coverage: t.subTopics,
        })),
      };

      if (matched) {
        matchedCount++;
      } else {
        unmatchedCount++;
        issues.push({
          severity: 'warning',
          message: `File "${baseFilename}": unit code "${code}" not found in database.`,
        });
      }

      parsedUnits.push(unit);
    } catch (err) {
      issues.push({
        severity: 'warning',
        message: `Failed to parse ${entry.filename}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  for (const unit of parsedUnits) {
    if (hasTopicCoverageContamination(unit.topics)) {
      issues.push({
        severity: 'error',
        message: `Unit "${unit.unitCode}" appears to have subtopic text mixed into its topic titles. Separate the topic heading from its coverage bullets before publishing.`,
      });
    }
  }

  return {
    ok: true,
    fileName,
    fileType: 'zip',
    totalUnits: parsedUnits.length,
    matchedCount,
    unmatchedCount,
    units: parsedUnits,
    issues,
  };
}
