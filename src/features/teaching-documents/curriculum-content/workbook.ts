import ExcelJS from 'exceljs';
import { unpackZipBuffer } from '../zip-ingestion';

export const SIMPLE_TEMPLATE_VERSION = '2.0';

export type CurriculumDocumentType = 'course_outline' | 'scheme_of_work';

const COURSE_TEMPLATE_KEY = 'academic-planner-course-outline-simple';
const SCHEME_TEMPLATE_KEY = 'academic-planner-scheme-of-work-simple';

const SHEETS = {
  instructions: 'Instructions',
  unitDetails: 'Unit Details',
  weeklyContent: 'Weekly Content',
  metadata: '_Metadata',
} as const;

const COURSE_UNIT_HEADERS = [
  'unit_code',
  'unit_name',
  'content_family_key',
  'curriculum_version',
  'unit_description',
  'core_learning_outcomes',
  'teaching_learning_approaches',
  'assessment_approaches',
  'references_resources',
] as const;

const COURSE_WEEK_HEADERS = [
  'unit_code',
  'week_number',
  'topic',
  'specific_coverage',
] as const;

const SCHEME_UNIT_HEADERS = [
  'unit_code',
  'unit_name',
  'content_family_key',
  'curriculum_version',
] as const;

const SCHEME_WEEK_HEADERS = [
  'unit_code',
  'week_number',
  'topic',
  'specific_coverage',
  'learning_outcomes',
  'teaching_learning_activities',
  'assessment_learning_check',
  'resources',
] as const;

const forbiddenWeekTopic =
  /\b(cat(?:s)?|continuous\s+assessment\s+tests?|exam(?:ination)?s?|revision|rat|readiness\s+assessment\s+test)\b/i;

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeCode(value: unknown) {
  return normalize(value).toUpperCase().replace(/\s+/g, ' ');
}

function normalizeKey(value: unknown) {
  return normalize(value)
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '_');
}

function splitList(value: string) {
  return value
    .split(/\s*\|\s*|\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17365D' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFC9D2DC' } },
    };
  });
  row.height = 30;
}

function addTitle(
  ws: ExcelJS.Worksheet,
  title: string,
  endColumn: string,
) {
  ws.mergeCells(`A1:${endColumn}1`);
  const cell = ws.getCell('A1');
  cell.value = title;
  cell.font = {
    bold: true,
    size: 16,
    color: { argb: 'FFFFFFFF' },
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF17365D' },
  };
  cell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
}

function addInstructions(
  workbook: ExcelJS.Workbook,
  label: string,
) {
  const ws = workbook.addWorksheet(SHEETS.instructions, {
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 10 }, { width: 92 }];

  addTitle(
    ws,
    `Imperial College Academic Planner — ${label} Template`,
    'B',
  );

  ws.addRow([]);
  ws.addRow(['Step', 'What to do']);
  styleHeader(ws.getRow(3));

  [
    ['1', 'Fill Unit Details once for each unit.'],
    ['2', 'Fill Week 1 to Week 14 in Weekly Content.'],
    ['3', 'Do not rename sheets or fixed column headers.'],
    ['4', 'Do not add CAT, examination or revision as curriculum weeks.'],
    ['5', 'Leave unsupported optional fields blank. Do not invent curriculum.'],
    ['6', 'Upload the completed Excel file through Academic Planner.'],
  ].forEach((row) => ws.addRow(row));

  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      row.alignment = {
        vertical: 'top',
        wrapText: true,
      };
    }
  });
}

function addMetadata(
  workbook: ExcelJS.Workbook,
  templateKey: string,
  documentType: CurriculumDocumentType,
) {
  const ws = workbook.addWorksheet(SHEETS.metadata, {
    state: 'veryHidden',
  });

  ws.addRows([
    ['template_key', templateKey],
    ['template_version', SIMPLE_TEMPLATE_VERSION],
    ['document_type', documentType],
    ['layout', 'unit-details-plus-weeks'],
    ['fixed_headers', 'true'],
  ]);
}

export async function generateCourseOutlineImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Imperial College Academic Planner';

  addInstructions(workbook, 'Course Outline');

  const details = workbook.addWorksheet(SHEETS.unitDetails, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  addTitle(details, 'Course Outline — Unit Details', 'I');
  details.addRow([]);
  details.addRow([...COURSE_UNIT_HEADERS]);
  styleHeader(details.getRow(3));

  [18, 42, 34, 18, 80, 90, 60, 55, 90].forEach(
    (width, index) => {
      details.getColumn(index + 1).width = width;
    },
  );

  // Blank rows are intentional. Only unit_code makes a row importable.
  for (let row = 0; row < 20; row += 1) {
    details.addRow(['', '', '', 1, '', '', '', '', '']);
  }

  details.getColumn(4).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) {
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 99],
      };
    }
  });

  const weeks = workbook.addWorksheet(SHEETS.weeklyContent, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  addTitle(weeks, 'Course Outline — 14-Week Content', 'D');
  weeks.addRow([]);
  weeks.addRow([...COURSE_WEEK_HEADERS]);
  styleHeader(weeks.getRow(3));

  [18, 12, 50, 95].forEach((width, index) => {
    weeks.getColumn(index + 1).width = width;
  });

  // Week numbers are prefilled for convenience.
  // Rows without unit_code are ignored during import.
  for (let week = 1; week <= 14; week += 1) {
    weeks.addRow(['', week, '', '']);
  }

  weeks.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) {
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 14],
      };
    }
  });

  addMetadata(
    workbook,
    COURSE_TEMPLATE_KEY,
    'course_outline',
  );

  return workbook.xlsx.writeBuffer();
}

export async function generateSchemeOfWorkImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Imperial College Academic Planner';

  addInstructions(workbook, 'Scheme of Work');

  const details = workbook.addWorksheet(SHEETS.unitDetails, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  addTitle(details, 'Scheme of Work — Unit Details', 'D');
  details.addRow([]);
  details.addRow([...SCHEME_UNIT_HEADERS]);
  styleHeader(details.getRow(3));

  [18, 42, 34, 18].forEach((width, index) => {
    details.getColumn(index + 1).width = width;
  });

  for (let row = 0; row < 20; row += 1) {
    details.addRow(['', '', '', 1]);
  }

  details.getColumn(4).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) {
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 99],
      };
    }
  });

  const weeks = workbook.addWorksheet(SHEETS.weeklyContent, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  addTitle(
    weeks,
    'Scheme of Work — 14-Week Delivery Plan',
    'H',
  );

  weeks.addRow([]);
  weeks.addRow([...SCHEME_WEEK_HEADERS]);
  styleHeader(weeks.getRow(3));

  [18, 12, 50, 72, 66, 60, 55, 55].forEach(
    (width, index) => {
      weeks.getColumn(index + 1).width = width;
    },
  );

  for (let week = 1; week <= 14; week += 1) {
    weeks.addRow(['', week, '', '', '', '', '', '']);
  }

  weeks.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) {
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 14],
      };
    }
  });

  addMetadata(
    workbook,
    SCHEME_TEMPLATE_KEY,
    'scheme_of_work',
  );

  return workbook.xlsx.writeBuffer();
}

export interface ParsedCurriculumContentWorkbook {
  templateVersion: string;
  documentType: CurriculumDocumentType;
  unitMappings: Record<string, string>[];
  curriculum: Record<string, string>[];
  outcomes: Record<string, string>[];
  weeks: Record<string, string>[];
  references: Record<string, string>[];
  errors: string[];
  warnings: string[];
}

function readMetadata(
  ws: ExcelJS.Worksheet,
) {
  const metadata = new Map<string, string>();

  ws.eachRow((row) => {
    const key = normalizeKey(row.getCell(1).value);
    const value = normalize(row.getCell(2).value);
    if (key) metadata.set(key, value);
  });

  return metadata;
}

function readExactHeaders(
  ws: ExcelJS.Worksheet,
  expected: readonly string[],
) {
  const actual = expected.map((_, index) =>
    normalizeKey(ws.getRow(3).getCell(index + 1).value),
  );

  return {
    actual,
    valid:
      actual.length === expected.length &&
      expected.every((header, index) => actual[index] === header),
  };
}

function assertNoExtraHeaders(
  ws: ExcelJS.Worksheet,
  expectedLength: number,
) {
  const row = ws.getRow(3);
  for (
    let column = expectedLength + 1;
    column <= Math.max(row.cellCount, expectedLength);
    column += 1
  ) {
    if (normalize(row.getCell(column).value)) {
      return false;
    }
  }
  return true;
}

function recordFromRow(
  row: ExcelJS.Row,
  headers: readonly string[],
) {
  const record: Record<string, string> = {};

  headers.forEach((header, index) => {
    record[header] = normalize(
      row.getCell(index + 1).value,
    );
  });

  return record;
}

interface RawWorkbookSheet {
  name: string;
  rows: string[][];
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

function stripXmlTags(value: string) {
  return decodeXml(
    value.replace(/<[^>]+>/g, ''),
  );
}

function columnIndexFromReference(reference: string) {
  const letters =
    reference.match(/^([A-Z]+)/i)?.[1]?.toUpperCase() ?? '';

  let index = 0;

  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return Math.max(0, index - 1);
}

function parseSharedStrings(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const sharedStrings: string[] = [];

  const entry = entries.find(
    (item) =>
      item.filename === 'xl/sharedStrings.xml',
  );

  if (!entry) return sharedStrings;

  const xml = entry.buffer.toString('utf8');
  const itemPattern = /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/g;

  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];
    const textParts: string[] = [];
    const textPattern =
      /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g;

    let textMatch: RegExpExecArray | null;

    while (
      (textMatch = textPattern.exec(itemXml)) !== null
    ) {
      textParts.push(
        decodeXml(textMatch[1]),
      );
    }

    sharedStrings.push(textParts.join(''));
  }

  return sharedStrings;
}

function parseWorkbookRelationships(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const relationships =
    new Map<string, string>();

  const entry = entries.find(
    (item) =>
      item.filename ===
      'xl/_rels/workbook.xml.rels',
  );

  if (!entry) return relationships;

  const xml = entry.buffer.toString('utf8');

  const pattern =
    /<Relationship\b([^>]*?)\/?>/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attrs = match[1];

    const id =
      attrs.match(/\bId="([^"]+)"/)?.[1] ?? '';

    const target =
      attrs.match(/\bTarget="([^"]+)"/)?.[1] ??
      '';

    const type =
      attrs.match(/\bType="([^"]+)"/)?.[1] ??
      '';

    if (
      id &&
      target &&
      /\/worksheet$/i.test(type)
    ) {
      const normalizedTarget = target
        .replace(/^\/+/, '')
        .replace(/^xl\//, '');

      relationships.set(
        id,
        `xl/${normalizedTarget}`,
      );
    }
  }

  return relationships;
}

function parseSheetDefinitions(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const sheets: {
    name: string;
    relationshipId: string;
  }[] = [];

  const entry = entries.find(
    (item) =>
      item.filename === 'xl/workbook.xml',
  );

  if (!entry) return sheets;

  const xml = entry.buffer.toString('utf8');
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*?)\/?>/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attrs = match[1];

    const rawName =
      attrs.match(/\bname="([^"]+)"/)?.[1] ??
      '';

    const relationshipId =
      attrs.match(/\br:id="([^"]+)"/)?.[1] ??
      '';

    if (rawName && relationshipId) {
      sheets.push({
        name: decodeXml(rawName),
        relationshipId,
      });
    }
  }

  return sheets;
}

function parseWorksheetRows(
  xml: string,
  sharedStrings: string[],
) {
  const rows: string[][] = [];
  const rowPattern =
    /<(?:[A-Za-z_][\w.-]*:)?row\b[^>]*?(?:r="(\d+)")?[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/g;

  let rowMatch: RegExpExecArray | null;
  let sequentialRowIndex = 0;

  while (
    (rowMatch = rowPattern.exec(xml)) !== null
  ) {
    const explicitRow = Number(rowMatch[1]);
    const rowIndex =
      Number.isFinite(explicitRow) &&
      explicitRow > 0
        ? explicitRow - 1
        : sequentialRowIndex;

    sequentialRowIndex = rowIndex + 1;

    const cells: string[] = [];
    const rowXml = rowMatch[2];

    const cellPattern =
      /<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*?)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/g;

    let cellMatch: RegExpExecArray | null;

    while (
      (cellMatch = cellPattern.exec(rowXml)) !== null
    ) {
      const attrs = cellMatch[1];
      const cellXml = cellMatch[2];

      const reference =
        attrs.match(/\br="([^"]+)"/)?.[1] ??
        '';

      const columnIndex =
        columnIndexFromReference(reference);

      while (cells.length <= columnIndex) {
        cells.push('');
      }

      const type =
        attrs.match(/\bt="([^"]+)"/)?.[1] ??
        '';

      let value = '';

      if (type === 'inlineStr') {
        const textParts: string[] = [];
        const textPattern =
          /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g;

        let textMatch: RegExpExecArray | null;

        while (
          (textMatch =
            textPattern.exec(cellXml)) !== null
        ) {
          textParts.push(
            decodeXml(textMatch[1]),
          );
        }

        value = textParts.join('');
      } else {
        const rawValue =
          cellXml.match(
            /<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/,
          )?.[1] ?? '';

        if (type === 's') {
          const sharedIndex = Number(rawValue);

          value =
            Number.isInteger(sharedIndex) &&
            sharedIndex >= 0
              ? sharedStrings[sharedIndex] ?? ''
              : '';
        } else {
          value = stripXmlTags(rawValue);
        }
      }

      cells[columnIndex] = value.trim();
    }

    while (rows.length <= rowIndex) {
      rows.push([]);
    }

    rows[rowIndex] = cells;
  }

  return rows;
}

function readWorkbookFromOoxml(
  arrayBuffer: ArrayBuffer,
): RawWorkbookSheet[] {
  const entries = unpackZipBuffer(
    Buffer.from(arrayBuffer),
  );

  if (entries.length === 0) {
    throw new Error(
      'The uploaded file could not be read as a valid Excel workbook.',
    );
  }

  const sharedStrings =
    parseSharedStrings(entries);

  const relationships =
    parseWorkbookRelationships(entries);

  const definitions =
    parseSheetDefinitions(entries);

  if (
    definitions.length === 0 ||
    relationships.size === 0
  ) {
    throw new Error(
      'The uploaded Excel workbook is missing required workbook relationships.',
    );
  }

  const sheets: RawWorkbookSheet[] = [];

  for (const definition of definitions) {
    const target = relationships.get(
      definition.relationshipId,
    );

    if (!target) continue;

    const sheetEntry = entries.find(
      (item) => item.filename === target,
    );

    if (!sheetEntry) continue;

    sheets.push({
      name: definition.name,
      rows: parseWorksheetRows(
        sheetEntry.buffer.toString('utf8'),
        sharedStrings,
      ),
    });
  }

  if (sheets.length === 0) {
    throw new Error(
      'The uploaded Excel workbook contains no readable worksheets.',
    );
  }

  return sheets;
}

function rawCell(
  sheet: RawWorkbookSheet,
  rowNumber: number,
  columnNumber: number,
) {
  return normalize(
    sheet.rows[rowNumber - 1]?.[
      columnNumber - 1
    ] ?? '',
  );
}

function rawRow(
  sheet: RawWorkbookSheet,
  rowNumber: number,
) {
  return sheet.rows[rowNumber - 1] ?? [];
}

function readRawMetadata(
  sheet: RawWorkbookSheet,
) {
  const metadata = new Map<string, string>();

  sheet.rows.forEach((row) => {
    const key = normalizeKey(row[0]);
    const value = normalize(row[1]);

    if (key) metadata.set(key, value);
  });

  return metadata;
}

function validateRawHeaders(
  sheet: RawWorkbookSheet,
  expected: readonly string[],
) {
  const row = rawRow(sheet, 3);

  const actual = expected.map(
    (_, index) => normalizeKey(row[index]),
  );

  const expectedMatch = expected.every(
    (header, index) =>
      actual[index] === header,
  );

  const extraHeaders = row
    .slice(expected.length)
    .some((value) => Boolean(normalize(value)));

  return expectedMatch && !extraHeaders;
}

function rawRecordFromRow(
  sheet: RawWorkbookSheet,
  rowNumber: number,
  headers: readonly string[],
) {
  const record: Record<string, string> = {};

  headers.forEach((header, index) => {
    record[header] = rawCell(
      sheet,
      rowNumber,
      index + 1,
    );
  });

  return record;
}

export async function parseCurriculumContentWorkbook(
  arrayBuffer: ArrayBuffer,
): Promise<ParsedCurriculumContentWorkbook> {
  const rawSheets =
    readWorkbookFromOoxml(arrayBuffer);

  const findSheet = (name: string) =>
    rawSheets.find(
      (sheet) =>
        sheet.name.trim().toLowerCase() ===
        name.toLowerCase(),
    );

  const metadataSheet =
    findSheet(SHEETS.metadata);

  const detailsSheet =
    findSheet(SHEETS.unitDetails);

  const weeklySheet =
    findSheet(SHEETS.weeklyContent);

  if (
    !metadataSheet ||
    !detailsSheet ||
    !weeklySheet
  ) {
    throw new Error(
      'This workbook is not an Academic Planner curriculum template. Download a fresh template from the system and use its existing sheets.',
    );
  }

  const metadata =
    readRawMetadata(metadataSheet);

  const templateKey =
    metadata.get('template_key') ?? '';

  const templateVersion =
    metadata.get('template_version') ?? '';

  const documentTypeValue =
    metadata.get('document_type') ?? '';

  let documentType: CurriculumDocumentType;

  if (
    templateKey === COURSE_TEMPLATE_KEY &&
    documentTypeValue === 'course_outline'
  ) {
    documentType = 'course_outline';
  } else if (
    templateKey === SCHEME_TEMPLATE_KEY &&
    documentTypeValue === 'scheme_of_work'
  ) {
    documentType = 'scheme_of_work';
  } else {
    throw new Error(
      'Unknown curriculum template. Download a fresh Course Outline or Scheme of Work template from Academic Planner.',
    );
  }

  if (
    templateVersion !==
    SIMPLE_TEMPLATE_VERSION
  ) {
    throw new Error(
      `Template version ${templateVersion || 'unknown'} is not supported. Download the current template from Academic Planner.`,
    );
  }

  const detailHeaders =
    documentType === 'course_outline'
      ? COURSE_UNIT_HEADERS
      : SCHEME_UNIT_HEADERS;

  const weekHeaders =
    documentType === 'course_outline'
      ? COURSE_WEEK_HEADERS
      : SCHEME_WEEK_HEADERS;

  if (
    !validateRawHeaders(
      detailsSheet,
      detailHeaders,
    )
  ) {
    throw new Error(
      `Unit Details headers do not match the system template. Required headers: ${detailHeaders.join(', ')}`,
    );
  }

  if (
    !validateRawHeaders(
      weeklySheet,
      weekHeaders,
    )
  ) {
    throw new Error(
      `Weekly Content headers do not match the system template. Required headers: ${weekHeaders.join(', ')}`,
    );
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const detailsByCode =
    new Map<string, Record<string, string>>();

  for (
    let rowNumber = 4;
    rowNumber <= detailsSheet.rows.length;
    rowNumber += 1
  ) {
    const record = rawRecordFromRow(
      detailsSheet,
      rowNumber,
      detailHeaders,
    );

    const code = normalizeCode(
      record.unit_code,
    );

    if (!code) continue;

    const unitName =
      normalize(record.unit_name);

    const familyKey =
      normalize(record.content_family_key);

    if (!unitName || !familyKey) {
      errors.push(
        `Unit Details row ${rowNumber}: unit_code, unit_name and content_family_key are required.`,
      );
      continue;
    }

    if (detailsByCode.has(code)) {
      errors.push(
        `Unit Details row ${rowNumber}: duplicate unit_code ${code}.`,
      );
      continue;
    }

    detailsByCode.set(code, {
      ...record,
      unit_code: code,
      unit_name: unitName,
      content_family_key: familyKey,
      curriculum_version:
        normalize(record.curriculum_version) ||
        '1',
    });
  }

  if (detailsByCode.size === 0) {
    errors.push(
      'No completed Unit Details rows were found.',
    );
  }

  const weeksByCode =
    new Map<string, Record<string, string>[]>();

  for (
    let rowNumber = 4;
    rowNumber <= weeklySheet.rows.length;
    rowNumber += 1
  ) {
    const record = rawRecordFromRow(
      weeklySheet,
      rowNumber,
      weekHeaders,
    );

    const code = normalizeCode(
      record.unit_code,
    );

    if (!code) continue;

    const rawWeek =
      normalize(record.week_number);

    const weekNumber = Number(rawWeek);

    const topic = normalize(record.topic);

    if (
      !Number.isInteger(weekNumber) ||
      weekNumber < 1 ||
      weekNumber > 14
    ) {
      errors.push(
        `Weekly Content row ${rowNumber}: week_number must be between 1 and 14.`,
      );
      continue;
    }

    if (!topic) {
      errors.push(
        `Weekly Content row ${rowNumber}: topic is required for ${code}, Week ${weekNumber}.`,
      );
      continue;
    }

    if (forbiddenWeekTopic.test(topic)) {
      errors.push(
        `Weekly Content row ${rowNumber}: "${topic}" is an assessment/revision schedule, not curriculum teaching content.`,
      );
      continue;
    }

    if (!detailsByCode.has(code)) {
      errors.push(
        `Weekly Content row ${rowNumber}: ${code} is not listed in Unit Details.`,
      );
      continue;
    }

    const list =
      weeksByCode.get(code) ?? [];

    if (
      list.some(
        (item) =>
          Number(item.week_number) ===
          weekNumber,
      )
    ) {
      errors.push(
        `Weekly Content row ${rowNumber}: duplicate Week ${weekNumber} for ${code}.`,
      );
      continue;
    }

    list.push({
      ...record,
      unit_code: code,
      week_number: String(weekNumber),
      topic,
    });

    weeksByCode.set(code, list);
  }

  for (const code of detailsByCode.keys()) {
    const unitWeeks =
      weeksByCode.get(code) ?? [];

    const present = new Set(
      unitWeeks.map((row) =>
        Number(row.week_number),
      ),
    );

    const missing = Array.from(
      { length: 14 },
      (_, index) => index + 1,
    ).filter(
      (week) => !present.has(week),
    );

    if (missing.length > 0) {
      errors.push(
        `${code}: missing curriculum week${missing.length === 1 ? '' : 's'} ${missing.join(', ')}.`,
      );
    }

    if (unitWeeks.length > 14) {
      errors.push(
        `${code}: more than 14 weekly curriculum rows were supplied.`,
      );
    }
  }

  const familyMetadata =
    new Map<string, Record<string, string>>();

  const unitMappings: Record<
    string,
    string
  >[] = [];

  const curriculum: Record<
    string,
    string
  >[] = [];

  const outcomes: Record<
    string,
    string
  >[] = [];

  const references: Record<
    string,
    string
  >[] = [];

  const weeks: Record<
    string,
    string
  >[] = [];

  for (const detail of detailsByCode.values()) {
    const familyKey =
      detail.content_family_key;

    unitMappings.push({
      unit_code: detail.unit_code,
      unit_name: detail.unit_name,
      content_family_key: familyKey,
      content_family_name: detail.unit_name,
      curriculum_version:
        detail.curriculum_version || '1',
      status: 'DRAFT',
    });

    if (!familyMetadata.has(familyKey)) {
      familyMetadata.set(
        familyKey,
        detail,
      );

      curriculum.push({
        content_family_key: familyKey,
        content_family_name:
          detail.unit_name,
        unit_description:
          detail.unit_description || '',
        overall_competency: '',
        teaching_learning_approaches:
          detail.teaching_learning_approaches ||
          '',
        assessment_approaches:
          detail.assessment_approaches || '',
        curriculum_version:
          detail.curriculum_version || '1',
      });

      splitList(
        detail.core_learning_outcomes || '',
      ).forEach((content, index) => {
        outcomes.push({
          content_family_key: familyKey,
          sequence: String(index + 1),
          learning_outcome: content,
        });
      });

      splitList(
        detail.references_resources || '',
      ).forEach((content, index) => {
        references.push({
          content_family_key: familyKey,
          sequence: String(index + 1),
          reference_resource: content,
        });
      });
    }
  }

  for (
    const [code, detail] of
    detailsByCode.entries()
  ) {
    const familyKey =
      detail.content_family_key;

    const unitWeeks = (
      weeksByCode.get(code) ?? []
    ).sort(
      (a, b) =>
        Number(a.week_number) -
        Number(b.week_number),
    );

    unitWeeks.forEach((row) => {
      weeks.push({
        content_family_key: familyKey,
        unit_code: code,
        week_number: row.week_number,
        topic: row.topic,
        specific_coverage:
          row.specific_coverage || '',
        learning_outcomes:
          documentType === 'scheme_of_work'
            ? row.learning_outcomes || ''
            : '',
        teaching_learning_activities:
          documentType === 'scheme_of_work'
            ? row.teaching_learning_activities ||
              ''
            : '',
        assessment_learning_check:
          documentType === 'scheme_of_work'
            ? row.assessment_learning_check ||
              ''
            : '',
        resources:
          documentType === 'scheme_of_work'
            ? row.resources || ''
            : '',
      });
    });
  }

  return {
    templateVersion,
    documentType,
    unitMappings,
    curriculum,
    outcomes,
    weeks,
    references,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}
