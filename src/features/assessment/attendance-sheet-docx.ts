import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  Paragraph,
  Packer,
  Table,
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
  color: '1F2937',
} as const;
const borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
} as const;

function paragraph(
  value: string,
  options: {
    bold?: boolean;
    size?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  } = {},
) {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.LEFT,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 0,
      line: 240,
    },
    children: [
      new TextRun({
        text: value,
        font: FONT,
        size: options.size ?? 19,
        bold: options.bold ?? false,
        color: '111827',
      }),
    ],
  });
}

function labelLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 30, line: 240 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, size: 18, bold: true }),
      new TextRun({ text: value, font: FONT, size: 18 }),
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

  const candidates = [...data.candidates].sort((first, second) =>
    compareAdmissionNumbers(first.admissionNumber, second.admissionNumber),
  );

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
    labelLine('Cohort', data.cohortName || data.programmeName),
    labelLine('Unit', `${data.unitCode} - ${data.unitName}`),
    ...(data.venueName ? [labelLine('Venue', data.venueName)] : []),
    new Paragraph({ spacing: { after: 60 } }),
  );

  let rows: TableRow[] = [];
  let columnWidths: number[] = [];

  if (isClass) {
    // Class Attendance (8 sessions)
    columnWidths = [500, 1800, 2600, ...Array(8).fill(600)];
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
      ...candidates.map((candidate, index) =>
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
            cell(String(candidates.length + i + 1), { align: AlignmentType.CENTER }),
            cell(''),
            cell(''),
            ...Array.from({ length: 8 }, () => cell('')),
          ],
        }),
      ),
    ];
  } else if (isExam) {
    // Exam Attendance & Script Register
    columnWidths = [550, 1900, 3100, 1400, 1550, 750];
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
      ...candidates.map((candidate, index) =>
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
            cell(String(candidates.length + i + 1), { align: AlignmentType.CENTER }),
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
    columnWidths = [600, 2000, 3800, 1900, 900];
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
      ...candidates.map((candidate, index) =>
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
            cell(String(candidates.length + i + 1), { align: AlignmentType.CENTER }),
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

  const certification: Paragraph[] = [
    new Paragraph({ spacing: { before: 180 } }),
  ];

  if (isClass) {
    certification.push(
      paragraph('Class Representative: _______________________   Comment: ________________________   Sign: __________', { size: 17, after: 80 }),
      paragraph('Trainer: __________________________________   Comment: ________________________   Sign: __________', { size: 17, after: 80 }),
      paragraph('HOD: ______________________________________   Comment: ________________________   Sign: __________', { size: 17, after: 80 }),
    );
  } else {
    if (isExam) {
      certification.push(
        paragraph(`Total Registered Candidates: ${candidates.length}    Total Scripts Collected: ___________    Total Absent Candidates: ___________`, { bold: true, size: 17, after: 120 }),
      );
    }
    certification.push(
      paragraph('Invigilator: _________________________________   Sign: __________________   Date: __________', { size: 17, after: 80 }),
      paragraph('Examiner: ___________________________________   Sign: __________________   Date: __________', { size: 17, after: 80 }),
      paragraph('Exam Officer: _______________________________   Sign: __________________   Date: __________', { size: 17, after: 80 }),
    );
  }

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
    sections: [
      {
        properties: {
          page: {
            margin: { top: 540, right: 540, bottom: 540, left: 540 },
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
        children: [...header, register, ...certification],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
