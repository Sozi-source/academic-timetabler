import ExcelJS from 'exceljs';

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

const forbiddenWeekTopic = /\b(cat|continuous assessment test|exam(?:ination)?|revision|rat|readiness assessment test)\b/i;

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFC9D2DC' } } };
  });
  row.height = 30;
}

function addTitle(ws: ExcelJS.Worksheet, title: string, endColumn: string) {
  ws.mergeCells(`A1:${endColumn}1`);
  const cell = ws.getCell('A1');
  cell.value = title;
  cell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  cell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
}

function addInstructions(workbook: ExcelJS.Workbook, label: string) {
  const ws = workbook.addWorksheet(SHEETS.instructions, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 10 }, { width: 92 }];
  addTitle(ws, `Academic Planner — Simple ${label} Import`, 'B');
  ws.addRow([]);
  ws.addRow(['Step', 'What to do']);
  styleHeader(ws.getRow(3));
  [
    ['1', 'Fill Unit Details once for each unit.'],
    ['2', 'Fill Week 1 to Week 14 in Weekly Content.'],
    ['3', 'Do not rename sheets or fixed column headers.'],
    ['4', 'Do not add CAT, examination or revision as curriculum weeks.'],
    ['5', 'Leave unsupported optional fields blank. Do not invent curriculum.'],
    ['6', 'Upload the completed .xlsx file through Academic Planner.'],
  ].forEach((row) => ws.addRow(row));
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) row.alignment = { vertical: 'top', wrapText: true };
  });
}

function addMetadata(workbook: ExcelJS.Workbook, templateKey: string, documentType: CurriculumDocumentType) {
  const ws = workbook.addWorksheet(SHEETS.metadata, { state: 'veryHidden' });
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
  workbook.creator = 'Academic Planner';
  addInstructions(workbook, 'Course Outline');

  const details = workbook.addWorksheet(SHEETS.unitDetails, { views: [{ state: 'frozen', ySplit: 3 }] });
  addTitle(details, 'Course Outline — Unit Details', 'I');
  details.addRow([]);
  details.addRow([...COURSE_UNIT_HEADERS]);
  styleHeader(details.getRow(3));
  [18, 42, 34, 18, 80, 90, 60, 55, 90].forEach((width, index) => { details.getColumn(index + 1).width = width; });
  for (let row = 0; row < 20; row += 1) details.addRow(['', '', '', 1, '', '', '', '', '']);
  details.getColumn(4).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) cell.dataValidation = { type: 'whole', operator: 'between', formulae: [1, 99] };
  });

  const weeks = workbook.addWorksheet(SHEETS.weeklyContent, { views: [{ state: 'frozen', ySplit: 3 }] });
  addTitle(weeks, 'Course Outline — 14-Week Content', 'D');
  weeks.addRow([]);
  weeks.addRow([...COURSE_WEEK_HEADERS]);
  styleHeader(weeks.getRow(3));
  [18, 12, 50, 95].forEach((width, index) => { weeks.getColumn(index + 1).width = width; });
  for (let week = 1; week <= 14; week += 1) weeks.addRow(['', week, '', '']);
  weeks.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) cell.dataValidation = { type: 'whole', operator: 'between', formulae: [1, 14] };
  });

  addMetadata(workbook, COURSE_TEMPLATE_KEY, 'course_outline');
  return workbook.xlsx.writeBuffer();
}

export async function generateSchemeOfWorkImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planner';
  addInstructions(workbook, 'Scheme of Work');

  const details = workbook.addWorksheet(SHEETS.unitDetails, { views: [{ state: 'frozen', ySplit: 3 }] });
  addTitle(details, 'Scheme of Work — Unit Details', 'D');
  details.addRow([]);
  details.addRow([...SCHEME_UNIT_HEADERS]);
  styleHeader(details.getRow(3));
  [18, 42, 34, 18].forEach((width, index) => { details.getColumn(index + 1).width = width; });
  for (let row = 0; row < 20; row += 1) details.addRow(['', '', '', 1]);
  details.getColumn(4).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) cell.dataValidation = { type: 'whole', operator: 'between', formulae: [1, 99] };
  });

  const weeks = workbook.addWorksheet(SHEETS.weeklyContent, { views: [{ state: 'frozen', ySplit: 3 }] });
  addTitle(weeks, 'Scheme of Work — 14-Week Delivery Plan', 'H');
  weeks.addRow([]);
  weeks.addRow([...SCHEME_WEEK_HEADERS]);
  styleHeader(weeks.getRow(3));
  [18, 12, 50, 72, 66, 60, 55, 55].forEach((width, index) => { weeks.getColumn(index + 1).width = width; });
  for (let week = 1; week <= 14; week += 1) weeks.addRow(['', week, '', '', '', '', '', '']);
  weeks.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber >= 4) cell.dataValidation = { type: 'whole', operator: 'between', formulae: [1, 14] };
  });

  addMetadata(workbook, SCHEME_TEMPLATE_KEY, 'scheme_of_work');
  return workbook.xlsx.writeBuffer();
}

function assertHeaders(ws: ExcelJS.Worksheet | undefined, expected: readonly string[]) {
  if (!ws) throw new Error('A required worksheet is missing. Download a fresh template from Academic Planner.');
  const actual = expected.map((_, index) => normalize(ws.getRow(3).getCell(index + 1).value));
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`Worksheet "${ws.name}" has changed headers. Download a fresh template and keep the fixed headings.`);
  }
  const unexpected = normalize(ws.getRow(3).getCell(expected.length + 1).value);
  if (unexpected) throw new Error(`Worksheet "${ws.name}" has extra columns. Use the fixed system template.`);
}

function rowsAsObjects(ws: ExcelJS.Worksheet, headers: readonly string[]) {
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return;
    const item: Record<string, string> = {};
    headers.forEach((header, index) => { item[header] = normalize(row.getCell(index + 1).value); });
    if (Object.values(item).some(Boolean)) rows.push(item);
  });
  return rows;
}

function splitList(value: string) {
  return value
    .split(/\s*\|\s*|\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export async function parseCurriculumContentWorkbook(buffer: ArrayBuffer): Promise<ParsedCurriculumContentWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as any);

  const metadata = workbook.getWorksheet(SHEETS.metadata);
  const templateKey = normalize(metadata?.getCell('B1').value);
  const templateVersion = normalize(metadata?.getCell('B2').value);
  const documentType = normalize(metadata?.getCell('B3').value) as CurriculumDocumentType;

  if (templateVersion !== SIMPLE_TEMPLATE_VERSION || ![COURSE_TEMPLATE_KEY, SCHEME_TEMPLATE_KEY].includes(templateKey)) {
    throw new Error('Unsupported curriculum template. Download a fresh Course Outline or Scheme of Work template from Academic Planner.');
  }
  if (documentType !== 'course_outline' && documentType !== 'scheme_of_work') {
    throw new Error('The workbook document type is invalid. Download a fresh template from Academic Planner.');
  }

  const detailsWs = workbook.getWorksheet(SHEETS.unitDetails);
  const weeksWs = workbook.getWorksheet(SHEETS.weeklyContent);
  const isCourse = documentType === 'course_outline';
  const detailHeaders = isCourse ? COURSE_UNIT_HEADERS : SCHEME_UNIT_HEADERS;
  const weekHeaders = isCourse ? COURSE_WEEK_HEADERS : SCHEME_WEEK_HEADERS;
  assertHeaders(detailsWs, detailHeaders);
  assertHeaders(weeksWs, weekHeaders);

  const details = rowsAsObjects(detailsWs!, detailHeaders);
  const weekly = rowsAsObjects(weeksWs!, weekHeaders);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (details.length === 0) errors.push('Add at least one unit in Unit Details.');

  const unitByCode = new Map<string, Record<string, string>>();
  for (const row of details) {
    const code = row.unit_code.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!code || !row.unit_name || !row.content_family_key) {
      errors.push('Every Unit Details row requires unit_code, unit_name and content_family_key.');
      continue;
    }
    if (unitByCode.has(code)) errors.push(`Unit Details contains duplicate unit code ${code}.`);
    unitByCode.set(code, { ...row, unit_code: code });
  }

  const weeklyByCode = new Map<string, Record<string, string>[]>();
  for (const row of weekly) {
    const code = row.unit_code.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!code) {
      errors.push('Every Weekly Content row requires unit_code.');
      continue;
    }
    if (!unitByCode.has(code)) {
      errors.push(`Weekly Content references ${code}, but that unit is missing from Unit Details.`);
      continue;
    }
    const week = Number(row.week_number);
    if (!Number.isInteger(week) || week < 1 || week > 14) errors.push(`${code}: week_number must be between 1 and 14.`);
    if (!row.topic) errors.push(`${code} Week ${row.week_number || '?'} requires a topic.`);
    if (forbiddenWeekTopic.test(row.topic)) errors.push(`${code} Week ${row.week_number}: CAT/exam/revision cannot be a curriculum topic.`);
    const list = weeklyByCode.get(code) ?? [];
    list.push({ ...row, unit_code: code });
    weeklyByCode.set(code, list);
  }

  for (const code of unitByCode.keys()) {
    const unitWeeks = weeklyByCode.get(code) ?? [];
    const numbers = unitWeeks.map((row) => Number(row.week_number)).sort((a, b) => a - b);
    const expected = Array.from({ length: 14 }, (_, index) => index + 1);
    if (numbers.length !== 14 || numbers.some((value, index) => value !== expected[index])) {
      errors.push(`${code} must contain Week 1 through Week 14 exactly once.`);
    }
  }

  const familyPrimary = new Map<string, string>();
  for (const [code, detail] of unitByCode.entries()) {
    if (!familyPrimary.has(detail.content_family_key)) familyPrimary.set(detail.content_family_key, code);
  }

  const unitMappings = [...unitByCode.values()].map((row) => ({
    unit_code: row.unit_code,
    unit_name: row.unit_name,
    content_family_key: row.content_family_key,
    content_family_name: row.unit_name,
    curriculum_version: row.curriculum_version || '1',
    status: 'DRAFT',
  }));

  const curriculum = [...familyPrimary.entries()].map(([familyKey, primaryCode]) => {
    const detail = unitByCode.get(primaryCode)!;
    return {
      content_family_key: familyKey,
      content_family_name: detail.unit_name || familyKey,
      unit_description: isCourse ? detail.unit_description || '' : '',
      overall_competency: '',
      teaching_learning_approaches: isCourse ? detail.teaching_learning_approaches || '' : '',
      assessment_approaches: isCourse ? detail.assessment_approaches || '' : '',
      curriculum_version: detail.curriculum_version || '1',
    };
  });

  const outcomes: Record<string, string>[] = [];
  const references: Record<string, string>[] = [];
  if (isCourse) {
    for (const [familyKey, primaryCode] of familyPrimary.entries()) {
      const detail = unitByCode.get(primaryCode)!;
      splitList(detail.core_learning_outcomes || '').forEach((text, index) => outcomes.push({
        content_family_key: familyKey,
        sequence: String(index + 1),
        learning_outcome: text,
      }));
      splitList(detail.references_resources || '').forEach((text, index) => references.push({
        content_family_key: familyKey,
        sequence: String(index + 1),
        reference_resource: text,
      }));
    }
  }

  const weeks: Record<string, string>[] = [];
  for (const [familyKey, primaryCode] of familyPrimary.entries()) {
    const sourceWeeks = [...(weeklyByCode.get(primaryCode) ?? [])].sort((a, b) => Number(a.week_number) - Number(b.week_number));
    sourceWeeks.forEach((row) => weeks.push({
      content_family_key: familyKey,
      week_number: row.week_number,
      topic: row.topic,
      specific_coverage: row.specific_coverage || '',
      learning_outcomes: isCourse ? '' : row.learning_outcomes || '',
      teaching_learning_activities: isCourse ? '' : row.teaching_learning_activities || '',
      assessment_learning_check: isCourse ? '' : row.assessment_learning_check || '',
      resources: isCourse ? '' : row.resources || '',
    }));

    // Shared-family safety: all unit variants must carry identical 14-week content.
    const primarySignature = sourceWeeks.map((row) => [row.week_number, row.topic, row.specific_coverage, row.learning_outcomes, row.teaching_learning_activities, row.assessment_learning_check, row.resources].join('|')).join('||');
    for (const [code, detail] of unitByCode.entries()) {
      if (code === primaryCode || detail.content_family_key !== familyKey) continue;
      const candidate = [...(weeklyByCode.get(code) ?? [])].sort((a, b) => Number(a.week_number) - Number(b.week_number));
      const candidateSignature = candidate.map((row) => [row.week_number, row.topic, row.specific_coverage, row.learning_outcomes, row.teaching_learning_activities, row.assessment_learning_check, row.resources].join('|')).join('||');
      if (candidateSignature !== primarySignature) errors.push(`${code} has different weekly content from shared family ${familyKey}. Shared units must use identical curriculum content.`);
    }
  }

  if (isCourse && references.length === 0) warnings.push('No references/resources were supplied. This is allowed but should be reviewed.');

  return { templateVersion, documentType, unitMappings, curriculum, outcomes, weeks, references, errors, warnings };
}
