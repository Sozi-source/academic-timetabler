import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const FONT = 'Times New Roman';

interface BlueprintSectionSpec {
  label: string;
  title: string;
  questionCount: number;
  marksEach: number;
  choiceAnswer: number | null;
  choiceOf: number | null;
}

interface ExportQuestionPart {
  label: string;
  text: string;
  marks: number;
}

interface ExportQuestionItem {
  sectionLabel: string;
  itemNumber: number;
  marks: number;
  stem: string;
  parts: ExportQuestionPart[];
}

export interface ExportableExamPaper {
  paperId: string;
  departmentName: string;
  programmeName: string | null;
  unitCode: string;
  unitName: string;
  periodName: string;
  paperKind: 'main' | 'supplementary';
  status: string;
  totalMarks: number;
  durationMinutes: number;
  instructions: string[];
  sections: BlueprintSectionSpec[];
  items: ExportQuestionItem[];
}

function departmentHeading(name: string): string {
  const upper = name.trim().toUpperCase();
  return upper.startsWith('DEPARTMENT OF ') ? upper : `DEPARTMENT OF ${upper}`;
}

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours} HR ${mins} MIN` : `${mins} MINUTES`;
}

function numberWord(value: number): string {
  const words: Record<number, string> = {
    1: 'ONE (1)',
    2: 'TWO (2)',
    3: 'THREE (3)',
    4: 'FOUR (4)',
    5: 'FIVE (5)',
    6: 'SIX (6)',
  };
  return words[value] ?? String(value);
}

function stripTrailingMarks(text: string): string {
  return text.replace(/\s*[([]\s*\d+\s*(?:marks?|mks?)\s*[)\]]\s*\.?\s*$/i, '').trim();
}

function parseBlueprintLayout(raw: unknown): {
  instructions: string[];
  sections: BlueprintSectionSpec[];
} {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { instructions: [], sections: [] };
  }
  const layout = raw as Record<string, unknown>;
  const instructions = Array.isArray(layout.instructions)
    ? layout.instructions.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    : [];
  const rawSections = Array.isArray(layout.sections) ? layout.sections : [];
  const sections: BlueprintSectionSpec[] = [];
  for (const entry of rawSections) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const sec = entry as Record<string, unknown>;
    const label = typeof sec.label === 'string' ? sec.label.trim() : '';
    if (!label) continue;
    const title = typeof sec.title === 'string' && sec.title.trim().length > 0
      ? sec.title.trim()
      : `Section ${label}`;
    const questionCount = typeof sec.question_count === 'number' ? sec.question_count : 0;
    const marksEach = typeof sec.marks_each === 'number' ? sec.marks_each : 0;
    const choice = typeof sec.choice === 'object' && sec.choice !== null && !Array.isArray(sec.choice)
      ? sec.choice as Record<string, unknown>
      : null;
    sections.push({
      label,
      title,
      questionCount,
      marksEach,
      choiceAnswer: typeof choice?.answer === 'number' ? choice.answer : null,
      choiceOf: typeof choice?.of === 'number' ? choice.of : null,
    });
  }
  return { instructions, sections };
}

export async function getExportableExamPaper(paperId: string): Promise<ExportableExamPaper | null> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;

  const supabase = await createClient();
  const { data: itemsData, error } = await supabase
    .from('exam_paper_items')
    .select(
      'section_label,item_number,marks,exam_questions!inner(body,body_text),exam_papers!inner(id,paper_kind,status,total_marks,department_id,units!inner(code,name,programmes(name)),academic_periods!inner(name),exam_blueprints!inner(total_marks,duration_minutes,layout))',
    )
    .eq('department_id', profile.activeDepartmentId)
    .eq('paper_id', paperId)
    .order('section_label')
    .order('item_number');

  if (error || !itemsData || itemsData.length === 0) return null;

  const first = itemsData[0];
  const paper = Array.isArray(first.exam_papers) ? first.exam_papers[0] : first.exam_papers;
  if (!paper) return null;
  const unit = Array.isArray(paper.units) ? paper.units[0] : paper.units;
  const period = Array.isArray(paper.academic_periods) ? paper.academic_periods[0] : paper.academic_periods;
  const blueprint = Array.isArray(paper.exam_blueprints) ? paper.exam_blueprints[0] : paper.exam_blueprints;
  const rawProgramme = unit?.programmes;
  const programme = Array.isArray(rawProgramme) ? rawProgramme[0] : rawProgramme;

  const { instructions, sections } = parseBlueprintLayout(blueprint?.layout);

  const items: ExportQuestionItem[] = itemsData.flatMap((row) => {
    const question = Array.isArray(row.exam_questions) ? row.exam_questions[0] : row.exam_questions;
    if (!question) return [];
    const rawBody = typeof question.body === 'object' && question.body !== null && !Array.isArray(question.body)
      ? question.body as Record<string, unknown>
      : null;
    const stem = typeof rawBody?.stem === 'string' && rawBody.stem.trim().length > 0
      ? rawBody.stem.trim()
      : question.body_text;
    const rawParts = Array.isArray(rawBody?.parts) ? rawBody.parts : [];
    const parts: ExportQuestionPart[] = rawParts.flatMap((part) => {
      if (typeof part !== 'object' || part === null || Array.isArray(part)) return [];
      const record = part as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      const marks = typeof record.own_marks === 'number'
        ? record.own_marks
        : typeof record.marks === 'number'
          ? record.marks
          : 0;
      return text ? [{ label, text, marks }] : [];
    });
    return [{
      sectionLabel: row.section_label,
      itemNumber: row.item_number,
      marks: row.marks ?? 0,
      stem,
      parts,
    }];
  });

  await supabase.from('exam_audit_log').insert({
    department_id: profile.activeDepartmentId,
    actor_id: profile.id,
    action: 'paper_exported',
    paper_id: paper.id,
    detail: { format: 'docx', item_count: items.length },
  });

  return {
    paperId: paper.id,
    departmentName: profile.departmentName,
    programmeName: programme?.name ?? null,
    unitCode: unit?.code ?? 'UNIT',
    unitName: unit?.name ?? 'Examination',
    periodName: period?.name ?? 'Academic Period',
    paperKind: paper.paper_kind === 'supplementary' ? 'supplementary' : 'main',
    status: paper.status,
    totalMarks: paper.total_marks ?? blueprint?.total_marks ?? 100,
    durationMinutes: blueprint?.duration_minutes ?? 120,
    instructions,
    sections,
    items,
  };
}

export async function buildExamPaperDocx(paper: ExportableExamPaper): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = await readFile(path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'));
  } catch {
    logo = null;
  }

  const children: Array<Paragraph | Table> = [];

  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            data: logo,
            transformation: { width: 110, height: 83 },
            type: 'png',
          }),
        ],
      }),
    );
  }

  const headerLines = [
    'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES',
    departmentHeading(paper.departmentName),
    ...(paper.programmeName ? [paper.programmeName.toUpperCase()] : []),
    `${paper.periodName.toUpperCase()} ${paper.paperKind === 'supplementary' ? 'SUPPLEMENTARY' : 'END OF TERM'} EXAMINATION`,
  ];

  for (const line of headerLines) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: line, font: FONT, bold: true, size: 24 })],
      }),
    );
  }

  const ruleBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' } as const;
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: { top: ruleBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 40 },
                  children: [
                    new TextRun({ text: 'UNIT CODE: ', font: FONT, bold: true, size: 22 }),
                    new TextRun({ text: paper.unitCode.toUpperCase(), font: FONT, bold: true, size: 22 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: { top: ruleBorder, bottom: noBorder, left: noBorder, right: noBorder },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 80, after: 40 },
                  children: [
                    new TextRun({ text: 'TIME ALLOWED: ', font: FONT, bold: true, size: 22 }),
                    new TextRun({ text: formatDuration(paper.durationMinutes), font: FONT, bold: true, size: 22 }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              borders: { top: noBorder, bottom: ruleBorder, left: noBorder, right: noBorder },
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 80 },
                  children: [
                    new TextRun({ text: 'UNIT TITLE: ', font: FONT, bold: true, size: 22 }),
                    new TextRun({ text: paper.unitName.toUpperCase(), font: FONT, bold: true, size: 22 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: { top: noBorder, bottom: ruleBorder, left: noBorder, right: noBorder },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 20, after: 80 },
                  children: [
                    new TextRun({ text: 'TOTAL MARKS: ', font: FONT, bold: true, size: 22 }),
                    new TextRun({ text: `${paper.totalMarks} MARKS`, font: FONT, bold: true, size: 22 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({
          text: 'INSTRUCTIONS TO CANDIDATES:',
          font: FONT,
          bold: true,
          underline: {},
          size: 22,
        }),
      ],
    }),
  );

  const defaultInstructions = [
    'Write your Admission Number clearly on the answer booklet provided. Do NOT write your name.',
    ...paper.sections.map((sec) => {
      const sectionMarks = sec.choiceAnswer
        ? sec.choiceAnswer * sec.marksEach
        : sec.questionCount * sec.marksEach;
      return sec.choiceAnswer
        ? `Answer ANY ${numberWord(sec.choiceAnswer)} questions in Section ${sec.label} (${sectionMarks} Marks).`
        : `Answer ALL questions in Section ${sec.label} (${sectionMarks} Marks).`;
    }),
    'All answers must be written in the answer booklet provided.',
  ];

  const candidateInstructions = paper.instructions.length > 0 ? defaultInstructions : defaultInstructions;
  candidateInstructions.forEach((line, index) => {
    children.push(
      new Paragraph({
        spacing: { after: 50 },
        indent: { left: 360, hanging: 260 },
        children: [
          new TextRun({ text: `${index + 1}. `, font: FONT, bold: true, size: 21 }),
          new TextRun({ text: line, font: FONT, size: 21 }),
        ],
      }),
    );
  });

  const sectionOrder = [...new Set(paper.items.map((item) => item.sectionLabel))];
  for (const sectionLabel of sectionOrder) {
    const sectionItems = paper.items.filter((item) => item.sectionLabel === sectionLabel);
    const spec = paper.sections.find((sec) => sec.label === sectionLabel);
    const sectionTotalMarks = spec
      ? (spec.choiceAnswer ? spec.choiceAnswer * spec.marksEach : spec.questionCount * spec.marksEach)
      : sectionItems.reduce((sum, item) => sum + item.marks, 0);
    const sectionTitle = spec?.title ? spec.title.toUpperCase() : `SECTION ${sectionLabel}`;
    const sectionRule = spec?.choiceAnswer
      ? `Answer ANY ${numberWord(spec.choiceAnswer)} questions from this section.`
      : 'Answer ALL questions in this section.';

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 260, after: 40 },
        children: [
          new TextRun({
            text: `SECTION ${sectionLabel}: ${sectionTitle} (${sectionTotalMarks} MARKS)`,
            font: FONT,
            bold: true,
            underline: {},
            size: 23,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: sectionRule,
            font: FONT,
            italics: true,
            bold: true,
            size: 21,
          }),
        ],
      }),
    );

    for (const item of sectionItems) {
      const hasParts = item.parts.length > 0;
      const cleanStem = stripTrailingMarks(item.stem);

      children.push(
        new Paragraph({
          spacing: { before: 120, after: hasParts ? 60 : 120, line: 276 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${item.itemNumber}. `, font: FONT, bold: true, size: 22 }),
            new TextRun({ text: cleanStem, font: FONT, size: 22 }),
            ...(!hasParts
              ? [
                  new TextRun({
                    text: ` (${item.marks} ${item.marks === 1 ? 'mark' : 'marks'})`,
                    font: FONT,
                    bold: true,
                    size: 22,
                  }),
                ]
              : []),
          ],
        }),
      );

      item.parts.forEach((part, partIndex) => {
        const cleanLabel = (part.label || String.fromCharCode(97 + partIndex)).replace(/^[([)]+|[)\].]+$/g, '');
        const cleanPartText = stripTrailingMarks(part.text);
        children.push(
          new Paragraph({
            spacing: { after: 60, line: 276 },
            indent: { left: 780, hanging: 360 },
            children: [
              new TextRun({ text: `(${cleanLabel}) `, font: FONT, bold: true, size: 22 }),
              new TextRun({ text: cleanPartText, font: FONT, size: 22 }),
              ...(part.marks > 0
                ? [
                    new TextRun({
                      text: ` (${part.marks} ${part.marks === 1 ? 'mark' : 'marks'})`,
                      font: FONT,
                      bold: true,
                      size: 22,
                    }),
                  ]
                : []),
            ],
          }),
        );
      });
    }
  }

  const doc = new Document({
    creator: paper.departmentName,
    title: `${paper.unitCode} ${paper.unitName} Examination`,
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${paper.unitCode.toUpperCase()} · Page `, font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
                  new TextRun({ text: ' of ', font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
