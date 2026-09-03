import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
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

import type { StudentPortalRegistrationContext } from './types';

const FONT = 'Arial';
const border = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '334155',
} as const;
const borders = { top: border, bottom: border, left: border, right: border } as const;

function line(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    italics?: boolean;
    color?: string;
  } = {},
) {
  return new Paragraph({
    alignment: options.align ?? AlignmentType.LEFT,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 20,
      line: 230,
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 20,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
        color: options.color ?? '0F172A',
      }),
    ],
  });
}

function cell(
  value: string,
  options: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shading?: string;
  } = {},
) {
  return new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.shading ? { fill: options.shading } : undefined,
    margins: { top: 55, bottom: 55, left: 100, right: 100 },
    children: [
      line(value, {
        bold: options.bold,
        size: options.size ?? 20,
        align: options.align,
        after: 0,
      }),
    ],
  });
}

function signOffLine(text: string, options: { bold?: boolean; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 0, line: 200 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 18,
        bold: options.bold ?? false,
        color: '000000',
      }),
    ],
  });
}

function signOffSection() {
  return [
    signOffLine('ACCOUNTS.', { bold: true }),
    signOffLine('Previous balance: KShs………………………………………………….………Amount Paid………….………………………………….'),
    signOffLine('Balance: KShs……………………………………………………………………Hostel Fees…………………………………………….'),
    signOffLine('Date: ……………………………………………………………………………Signature: ………………………………………', { after: 45 }),
    signOffLine('Approved/not approved by: HOD: ……………………………………………Date: ………………………………………….'),
    signOffLine('Comment: ………………………………………………………………………Signature: ……………………………………', { after: 45 }),
    signOffLine('HOSTEL ALLOCATION.', { bold: true }),
    signOffLine('Administrator: …………………………………………………………………Date: ………………………………………….'),
    signOffLine('Comment: …………………………………………………………………………………Signature………………………………………', { after: 45 }),
    signOffLine('REGISTRAR: …………………………………………………………….Date: ………………………………………….'),
    signOffLine('Comment: ……………………………………………………………….Signature: ………………………………………', { after: 45 }),
    signOffLine('PRINCIPAL: ………………………………………………… ……….Date: ………………………………………'),
    signOffLine('Comment: ………………………………………………………………….Signature: ……………………………………', { after: 45 }),
    signOffLine('MANAGING DIRECTOR: ………………………………………………Date: ……………………………….'),
    signOffLine('Comment: ………………………………………………………………….Signature: …………………………………….'),
  ];
}

const spacer = () => new Paragraph({ spacing: { after: 70, line: 220 } });

export async function buildStudentUnitRegistrationDocx(
  context: StudentPortalRegistrationContext,
): Promise<Buffer> {
  if (!context.period) {
    throw new Error('No active academic period is available.');
  }

  const units = context.units
    .filter((unit) => unit.registrationStatus === 'registered')
    .sort((first, second) =>
      first.unitCode.localeCompare(second.unitCode, 'en', { numeric: true }),
    );

  if (units.length === 0) {
    throw new Error('No assigned units are available for this period.');
  }

  let logo: Buffer | null = null;
  try {
    logo = await readFile(
      path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'),
    );
  } catch {
    logo = null;
  }

  const children: Array<Paragraph | Table> = [];
  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new ImageRun({
            data: logo,
            type: 'png',
            transformation: { width: 62, height: 46 },
          }),
        ],
      }),
    );
  }

  children.push(
    line('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
      bold: true,
      size: 24,
      align: AlignmentType.CENTER,
      after: 15,
    }),
    line('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: 21,
      align: AlignmentType.CENTER,
      after: 15,
    }),
    line(context.student.programmeName.toUpperCase(), {
      bold: true,
      size: 19.5,
      align: AlignmentType.CENTER,
      after: 55,
    }),
  );

  // Student Profile Summary Box
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [5000, 5000],
      rows: [
        new TableRow({
          height: { value: 290, rule: 'atLeast' },
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true, size: 20 }),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true, size: 20 }),
          ],
        }),
        new TableRow({
          height: { value: 290, rule: 'atLeast' },
          children: [
            cell(`Course: ${context.student.programmeName}`, { size: 20 }),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? ''}`, { size: 20 }),
          ],
        }),
        new TableRow({
          height: { value: 290, rule: 'atLeast' },
          children: [
            cell(`Department: ${context.student.departmentName}`, { size: 20 }),
            cell(`Intake: ${context.student.cohortName ?? ''}`, { size: 20 }),
          ],
        }),
        new TableRow({
          height: { value: 290, rule: 'atLeast' },
          children: [
            cell(`Academic Period: ${context.period.name}`, { size: 20 }),
            cell('Resident:', { size: 20 }),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: 20,
      align: AlignmentType.CENTER,
      before: 45,
      after: 25,
    }),
  );

  // Registered Units Table
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [850, 1900, 7250],
      rows: [
        new TableRow({
          tableHeader: true,
          height: { value: 290, rule: 'atLeast' },
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5', size: 20 }),
            cell('Unit Code', { bold: true, shading: 'E8EEF5', size: 20 }),
            cell('Unit Name', { bold: true, shading: 'E8EEF5', size: 20 }),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 290, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER, size: 20 }),
              cell(unit.unitCode, { bold: true, size: 20 }),
              cell(unit.unitName, { size: 20 }),
            ],
          }),
        ),
      ],
    }),
  );

  children.push(
    spacer(),
    ...signOffSection(),
  );

  const document = new Document({
    creator: 'Imperial College of Medical and Health Sciences',
    title: `${context.student.admissionNumber} Unit Registration`,
    description: 'Continuing student unit registration form',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { line: 220, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // Fixed A4 print area. The compact reference sign-off sequence and
            // registered-unit roster are designed to remain on this one page.
            size: { width: 11906, height: 16838 },
            margin: { top: 300, right: 400, bottom: 300, left: 400 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 0 },
                children: [
                  new TextRun({
                    text: 'This form should be filled in one copy and filed in HODs and Registrar’s Office.',
                    font: 'Times New Roman',
                    size: 18,
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
