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
  Paragraph,
  Packer,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';

export interface AttendanceSheetDocumentCandidate {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortName?: string;
}

export interface AttendanceSheetDocumentData {
  type: 'class' | 'cat' | 'exam';
  institutionName: string;
  campusName: string;
  schoolName: string;
  departmentName: string;
  programmeName: string;
  cohortName?: string;
  academicPeriodName: string;
  unitCode: string;
  unitName: string;
  trainerName?: string;
  venueName?: string;
  candidates: AttendanceSheetDocumentCandidate[];
}

const FONT = 'Arial';
const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '94A3B8',
} as const;

const borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
} as const;

const noBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
} as const;

const transparentBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
} as const;

const underlineBorders = {
  top: noBorder,
  bottom: thinBorder,
  left: noBorder,
  right: noBorder,
} as const;

function paragraph(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
    color?: string;
    keepLines?: boolean;
  } = {},
) {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.LEFT,
    spacing: { after: options.after ?? 40, line: 240 },
    keepLines: options.keepLines,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size ?? 18,
        font: FONT,
        color: options.color,
      }),
    ],
  });
}

function labelLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 30, line: 240 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 18, font: FONT }),
      new TextRun({ text: value, size: 18, font: FONT }),
    ],
  });
}

function cell(
  value: string,
  options: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shading?: string;
  } = {},
) {
  return new TableCell({
    borders,
    shading: options.shading ? { fill: options.shading } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      paragraph(value, {
        bold: options.bold,
        size: 16,
        alignment: options.align,
      }),
    ],
  });
}

function signoffLabelCell(
  text: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
) {
  return new TableCell({
    borders: transparentBorders,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 60, bottom: 40, left: 40, right: 40 },
    children: [
      paragraph(text.replace(/ /g, '\u00A0'), {
        bold: true,
        size: 17,
        alignment: align,
        after: 0,
        keepLines: true,
      }),
    ],
  });
}

function signoffLineCell(text: string = '', bold: boolean = false) {
  return new TableCell({
    borders: underlineBorders,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 60, bottom: 40, left: 40, right: 40 },
    children: [
      paragraph(text, {
        bold,
        size: 17,
        alignment: AlignmentType.LEFT,
        color: '1F2937',
        after: 0,
      }),
    ],
  });
}


export async function generateAttendanceSheetDocx(
  data: AttendanceSheetDocumentData,
): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = await readFile(
      path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'),
    );
  } catch {
    logo = null;
  }

  const isClass = data.type === 'class';
  const isExam = data.type === 'exam';
  const heading = isClass
    ? 'CLASS ATTENDANCE LIST'
    : isExam
      ? 'FINAL EXAMINATION ATTENDANCE & SCRIPT REGISTER'
      : 'CONTINUOUS ASSESSMENT TEST (CAT) ATTENDANCE LIST';

  // Group candidates by cohort if multiple cohorts are present
  const cohortGroups = new Map<string, AttendanceSheetDocumentCandidate[]>();
  for (const cand of data.candidates) {
    const cName = cand.cohortName || data.cohortName || 'Cohort';
    if (!cohortGroups.has(cName)) {
      cohortGroups.set(cName, []);
    }
    cohortGroups.get(cName)!.push(cand);
  }

  const groups = Array.from(cohortGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cName, list]) => ({
      cohortName: cName,
      candidates: [...list].sort((first, second) =>
        compareAdmissionNumbers(first.admissionNumber, second.admissionNumber),
      ),
    }));

  if (groups.length === 0) {
    groups.push({
      cohortName: data.cohortName || 'Cohort',
      candidates: [],
    });
  }

  // Build a distinct Word section per cohort
  const sections = groups.map((group) => {
    const header: Array<Paragraph | Table> = [];
    if (logo) {
      header.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 30 },
          children: [
            new ImageRun({
              data: logo,
              type: 'png',
              transformation: { width: 64, height: 64 },
            }),
          ],
        }),
      );
    }

    header.push(
      paragraph(data.institutionName, {
        bold: true,
        size: 23,
        alignment: AlignmentType.CENTER,
        after: 20,
      }),
      paragraph(heading, {
        bold: true,
        size: 21,
        alignment: AlignmentType.CENTER,
        after: 20,
      }),
      paragraph(data.academicPeriodName, {
        bold: true,
        size: 19,
        alignment: AlignmentType.CENTER,
        after: 80,
      }),
      labelLine('School', data.schoolName),
      labelLine('Department', data.departmentName),
      labelLine('Cohort', group.cohortName),
      labelLine('Unit', `${data.unitCode} - ${data.unitName}`),
      ...(data.venueName ? [labelLine('Venue', data.venueName)] : []),
      new Paragraph({ spacing: { after: 60 } }),
    );

    let rows: TableRow[] = [];
    let columnWidths: number[] = [];

    if (isClass) {
      // Class Attendance (8 sessions) - A4 Landscape (15400 dxa usable width)
      columnWidths = [700, 2600, 4500, ...Array(8).fill(950)];
      rows = [
        new TableRow({
          tableHeader: true,
          children: [
            cell('No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Adm No.', { bold: true, shading: 'E8EEF5' }),
            cell('Name', { bold: true, shading: 'E8EEF5' }),
            ...Array.from({ length: 8 }, () =>
              cell('Sign', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            ),
          ],
        }),
        ...group.candidates.map((candidate, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 360, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER }),
              cell(candidate.admissionNumber),
              cell(candidate.fullName.toUpperCase()),
              ...Array.from({ length: 8 }, () => cell('')),
            ],
          }),
        ),
        // 4 blank rows
        ...Array.from({ length: 4 }, (_, i) =>
          new TableRow({
            cantSplit: true,
            height: { value: 360, rule: 'atLeast' },
            children: [
              cell(String(group.candidates.length + i + 1), { align: AlignmentType.CENTER }),
              cell(''),
              cell(''),
              ...Array.from({ length: 8 }, () => cell('')),
            ],
          }),
        ),
      ];
    } else if (isExam) {
      // Exam Attendance & Script Register
      columnWidths = [550, 2200, 2800, 1400, 1550, 750];
      rows = [
        new TableRow({
          tableHeader: true,
          children: [
            cell('No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Adm No.', { bold: true, shading: 'E8EEF5' }),
            cell('Candidate Name', { bold: true, shading: 'E8EEF5' }),
            cell('Booklet Serial No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Candidate Signature', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Marks', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
          ],
        }),
        ...group.candidates.map((candidate, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 380, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER }),
              cell(candidate.admissionNumber),
              cell(candidate.fullName.toUpperCase()),
              cell(''),
              cell(''),
              cell(''),
            ],
          }),
        ),
        // 4 blank rows
        ...Array.from({ length: 4 }, (_, i) =>
          new TableRow({
            cantSplit: true,
            height: { value: 380, rule: 'atLeast' },
            children: [
              cell(String(group.candidates.length + i + 1), { align: AlignmentType.CENTER }),
              cell(''),
              cell(''),
              cell(''),
              cell(''),
              cell(''),
            ],
          }),
        ),
      ];
    } else {
      // CAT Attendance List (No booklet number)
      columnWidths = [600, 2300, 3500, 1900, 900];
      rows = [
        new TableRow({
          tableHeader: true,
          children: [
            cell('No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Adm No.', { bold: true, shading: 'E8EEF5' }),
            cell('Candidate Name', { bold: true, shading: 'E8EEF5' }),
            cell('Candidate Signature', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Marks', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
          ],
        }),
        ...group.candidates.map((candidate, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 380, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER }),
              cell(candidate.admissionNumber),
              cell(candidate.fullName.toUpperCase()),
              cell(''),
              cell(''),
            ],
          }),
        ),
        // 4 blank rows
        ...Array.from({ length: 4 }, (_, i) =>
          new TableRow({
            cantSplit: true,
            height: { value: 380, rule: 'atLeast' },
            children: [
              cell(String(group.candidates.length + i + 1), { align: AlignmentType.CENTER }),
              cell(''),
              cell(''),
              cell(''),
              cell(''),
            ],
          }),
        ),
      ];
    }

    const register = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths,
      rows,
    });

    let certificationElements: Array<Paragraph | Table> = [];

    if (isClass) {
      // Clean, Full-Width Landscape Sign-off Table (Exact match to Web Preview)
      const signoffTable = new Table({
        borders: TableBorders.NONE,
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2800, 2600, 1500, 6000, 900, 1600],
        rows: [
          new TableRow({
            cantSplit: true,
            height: { value: 460, rule: 'atLeast' },
            children: [
              signoffLabelCell('Class Representative:'),
              signoffLineCell(''),
              signoffLabelCell('Comment:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
          new TableRow({
            cantSplit: true,
            height: { value: 460, rule: 'atLeast' },
            children: [
              signoffLabelCell('Trainer:'),
              signoffLineCell(data.trainerName || '', true),
              signoffLabelCell('Comment:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
          new TableRow({
            cantSplit: true,
            height: { value: 460, rule: 'atLeast' },
            children: [
              signoffLabelCell('HOD:'),
              signoffLineCell(''),
              signoffLabelCell('Comment:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
        ],
      });

      certificationElements = [
        new Paragraph({ spacing: { before: 280 } }),
        signoffTable,
      ];
    } else {
      if (isExam) {
        certificationElements.push(
          paragraph(
            `Total Registered Candidates: ${group.candidates.length}    Total Scripts Collected: ___________    Total Absent Candidates: ___________`,
            { bold: true, size: 17, after: 120 },
          ),
        );
      }

      const signoffTable = new Table({
        borders: TableBorders.NONE,
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2200, 3600, 800, 1800, 700, 1366],
        rows: [
          new TableRow({
            cantSplit: true,
            height: { value: 420, rule: 'atLeast' },
            children: [
              signoffLabelCell('Invigilator:'),
              signoffLineCell(''),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Date:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
          new TableRow({
            cantSplit: true,
            height: { value: 420, rule: 'atLeast' },
            children: [
              signoffLabelCell('Examiner:'),
              signoffLineCell(data.trainerName || '', true),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Date:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
          new TableRow({
            cantSplit: true,
            height: { value: 420, rule: 'atLeast' },
            children: [
              signoffLabelCell('Exam Officer:'),
              signoffLineCell(''),
              signoffLabelCell('Sign:', AlignmentType.RIGHT),
              signoffLineCell(''),
              signoffLabelCell('Date:', AlignmentType.RIGHT),
              signoffLineCell(''),
            ],
          }),
        ],
      });

      certificationElements.push(
        new Paragraph({ spacing: { before: 200 } }),
        signoffTable,
      );
    }

    return {
      properties: {
        page: {
          size: {
            orientation: isClass ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            width: isClass ? 16838 : 11906,
            height: isClass ? 11906 : 16838,
          },
          margin: { top: 540, right: 720, bottom: 540, left: 720 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', font: FONT, size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }),
                new TextRun({ text: ' of ', font: FONT, size: 16 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16 }),
              ],
            }),
          ],
        }),
      },
      children: [...header, register, ...certificationElements],
    };
  });

  const document = new Document({
    creator: data.institutionName,
    title: `${data.unitName} - ${heading}`,
    description: 'Attendance & Signing Sheet',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 19 },
          paragraph: { spacing: { after: 0, line: 240 } },
        },
      },
    },
    sections,
  });

  return Buffer.from(await Packer.toBuffer(document));
}
