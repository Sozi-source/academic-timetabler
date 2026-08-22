import ExcelJS from 'exceljs';

export const CURRICULUM_CONTENT_TEMPLATE_VERSION = '1.0';

const SHEETS = {
  instructions: 'Instructions',
  unitMapping: 'Unit Mapping',
  curriculum: 'Curriculum',
  outcomes: 'Learning Outcomes',
  weeks: 'Weekly Content',
  references: 'References',
  metadata: '_Metadata',
} as const;

const HEADERS = {
  unitMapping: ['unit_code','unit_name','content_family_key','content_family_name','curriculum_version','status'],
  curriculum: ['content_family_key','content_family_name','unit_description','overall_competency','teaching_learning_approaches','assessment_approaches','curriculum_version'],
  outcomes: ['content_family_key','sequence','learning_outcome'],
  weeks: ['content_family_key','week_number','topic','specific_coverage','learning_outcomes','teaching_learning_activities','assessment_learning_check','resources'],
  references: ['content_family_key','sequence','reference_resource'],
} as const;

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
  row.height = 28;
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, headers: readonly string[], widths: number[]) {
  const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow([...headers]);
  styleHeader(ws.getRow(1));
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
  return ws;
}

export async function generateCurriculumContentTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planner';

  const instructions = workbook.addWorksheet(SHEETS.instructions, { views: [{ showGridLines: false }] });
  instructions.columns = [{ width: 28 }, { width: 92 }];
  instructions.mergeCells('A1:B1');
  instructions.getCell('A1').value = 'Academic Planner Curriculum Content Import';
  instructions.getCell('A1').font = { bold: true, size: 17, color: { argb: 'FFFFFFFF' } };
  instructions.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  instructions.getRow(1).height = 30;
  const rules = [
    ['Workbook format','Use this Excel .xlsx template only. Do not rename required sheets or headers.'],
    ['Unit identity','Unit Code must already exist in Academic Planner. Unit Name is used for review.'],
    ['Shared curriculum','Use the same content_family_key for Certificate/Diploma units that genuinely share curriculum.'],
    ['Teaching weeks','Each content family must have Week 1 through Week 14 exactly once.'],
    ['Assessment scheduling','Do not add CAT, exam or revision weeks. These belong to the academic calendar.'],
    ['Missing content','Leave unsupported optional cells blank. Do not fabricate content.'],
    ['Approval','New imports enter Draft status and must be reviewed before approval.'],
  ];
  instructions.addRow(['Rule','Requirement']); styleHeader(instructions.getRow(3));
  rules.forEach((r) => instructions.addRow(r));
  instructions.getColumn(1).font = { bold: true };

  const map = addDataSheet(workbook,SHEETS.unitMapping,HEADERS.unitMapping,[18,42,34,42,18,16]);
  map.addRow(['CND 2306','Agricultural Production','AGRICULTURAL_PRODUCTION','Agricultural Production',1,'DRAFT']);

  const curriculum = addDataSheet(workbook,SHEETS.curriculum,HEADERS.curriculum,[34,42,80,65,60,60,18]);
  curriculum.addRow(['AGRICULTURAL_PRODUCTION','Agricultural Production','','','','',1]);

  const outcomes = addDataSheet(workbook,SHEETS.outcomes,HEADERS.outcomes,[34,10,90]);
  outcomes.addRow(['AGRICULTURAL_PRODUCTION',1,'']);

  const weeks = addDataSheet(workbook,SHEETS.weeks,HEADERS.weeks,[34,11,45,80,65,60,55,55]);
  for (let week = 1; week <= 14; week += 1) weeks.addRow(['AGRICULTURAL_PRODUCTION',week,'','','','','','']);

  const refs = addDataSheet(workbook,SHEETS.references,HEADERS.references,[34,10,95]);
  refs.addRow(['AGRICULTURAL_PRODUCTION',1,'']);

  const metadata = workbook.addWorksheet(SHEETS.metadata, { state: 'veryHidden' });
  metadata.addRows([
    ['template_key','academic-planner-curriculum-content'],
    ['template_version',CURRICULUM_CONTENT_TEMPLATE_VERSION],
  ]);

  return workbook.xlsx.writeBuffer();
}

function assertHeaders(ws: ExcelJS.Worksheet | undefined, expected: readonly string[]) {
  if (!ws) throw new Error('A required worksheet is missing. Download a fresh template from Academic Planner.');
  const actual = expected.map((_, index) => normalize(ws.getRow(1).getCell(index + 1).value));
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`Worksheet "${ws.name}" has changed headers. Download a fresh template and keep the fixed headings.`);
  }
}

function rowsAsObjects(ws: ExcelJS.Worksheet, headers: readonly string[]) {
  const rows: Record<string,string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: Record<string,string> = {};
    headers.forEach((header,index) => { item[header] = normalize(row.getCell(index + 1).value); });
    if (Object.values(item).some(Boolean)) rows.push(item);
  });
  return rows;
}

const forbiddenWeekTopic = /\b(cat|continuous assessment test|exam(?:ination)?|revision|rat|readiness assessment test)\b/i;

export interface ParsedCurriculumContentWorkbook {
  templateVersion: string;
  unitMappings: Record<string,string>[];
  curriculum: Record<string,string>[];
  outcomes: Record<string,string>[];
  weeks: Record<string,string>[];
  references: Record<string,string>[];
  errors: string[];
  warnings: string[];
}

export async function parseCurriculumContentWorkbook(buffer: ArrayBuffer): Promise<ParsedCurriculumContentWorkbook> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS currently ships Buffer typings that can differ from newer Node typings.
  // The runtime value is a normal Node Buffer; keep the cast local to this library boundary.
  await workbook.xlsx.load(Buffer.from(buffer) as any);
  const metadata = workbook.getWorksheet(SHEETS.metadata);
  const templateVersion = normalize(metadata?.getCell('B2').value);
  if (normalize(metadata?.getCell('B1').value) !== 'academic-planner-curriculum-content' || templateVersion !== CURRICULUM_CONTENT_TEMPLATE_VERSION) {
    throw new Error('Unsupported curriculum content template. Download the current template from Academic Planner.');
  }

  const mapWs = workbook.getWorksheet(SHEETS.unitMapping);
  const curriculumWs = workbook.getWorksheet(SHEETS.curriculum);
  const outcomeWs = workbook.getWorksheet(SHEETS.outcomes);
  const weekWs = workbook.getWorksheet(SHEETS.weeks);
  const refWs = workbook.getWorksheet(SHEETS.references);
  assertHeaders(mapWs,HEADERS.unitMapping); assertHeaders(curriculumWs,HEADERS.curriculum);
  assertHeaders(outcomeWs,HEADERS.outcomes); assertHeaders(weekWs,HEADERS.weeks); assertHeaders(refWs,HEADERS.references);

  const unitMappings = rowsAsObjects(mapWs!,HEADERS.unitMapping);
  const curriculum = rowsAsObjects(curriculumWs!,HEADERS.curriculum);
  const outcomes = rowsAsObjects(outcomeWs!,HEADERS.outcomes);
  const weeks = rowsAsObjects(weekWs!,HEADERS.weeks);
  const references = rowsAsObjects(refWs!,HEADERS.references);
  const errors: string[] = [];
  const warnings: string[] = [];

  const families = new Set(curriculum.map((r) => r.content_family_key).filter(Boolean));
  if (families.size === 0) errors.push('Add at least one curriculum family in the Curriculum worksheet.');

  for (const row of unitMappings) {
    if (!row.unit_code || !row.content_family_key) errors.push('Every Unit Mapping row requires unit_code and content_family_key.');
    if (row.content_family_key && !families.has(row.content_family_key)) errors.push(`Unit ${row.unit_code || '(blank)'} references missing family ${row.content_family_key}.`);
  }

  for (const family of families) {
    const familyWeeks = weeks.filter((r) => r.content_family_key === family);
    const numbers = familyWeeks.map((r) => Number(r.week_number)).sort((a,b) => a-b);
    const expected = Array.from({ length: 14 }, (_, i) => i + 1);
    if (numbers.length !== 14 || numbers.some((value,index) => value !== expected[index])) {
      errors.push(`${family} must contain Week 1 through Week 14 exactly once.`);
    }
    for (const row of familyWeeks) {
      if (!row.topic) errors.push(`${family} Week ${row.week_number || '?'} requires a topic.`);
      if (forbiddenWeekTopic.test(row.topic)) errors.push(`${family} Week ${row.week_number}: CAT/exam/revision scheduling cannot be a curriculum topic.`);
    }
  }

  for (const row of outcomes) {
    if (row.content_family_key && !families.has(row.content_family_key)) errors.push(`Learning Outcomes references missing family ${row.content_family_key}.`);
  }
  for (const row of references) {
    if (row.content_family_key && !families.has(row.content_family_key)) errors.push(`References references missing family ${row.content_family_key}.`);
  }

  if (references.length === 0) warnings.push('No references/resources were supplied. This is allowed but should be reviewed.');

  return { templateVersion, unitMappings, curriculum, outcomes, weeks, references, errors, warnings };
}
