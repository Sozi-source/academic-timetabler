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

// Accounts Clearance block with expanded Date space (32%)
function accountsBox() {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 3200, 3200],
    rows: [
      // Shaded Header
      new TableRow({
        children: [
          new TableCell({
            borders,
            columnSpan: 3,
            shading: { fill: 'E8EEF5' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 45, bottom: 45, left: 100, right: 100 },
            children: [
              line('ACCOUNTS CLEARANCE', {
                bold: true,
                size: 20,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      // Balances
      new TableRow({
        height: { value: 310, rule: 'atLeast' },
        children: [
          cell('Previous Balance: KShs', { size: 20 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 55, bottom: 55, left: 100, right: 100 },
            children: [line('Amount Paid: KShs', { size: 20, after: 0 })],
          }),
        ],
      }),
      new TableRow({
        height: { value: 310, rule: 'atLeast' },
        children: [
          cell('Current Balance: KShs', { size: 20 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 55, bottom: 55, left: 100, right: 100 },
            children: [line('Hostel Fees: KShs', { size: 20, after: 0 })],
          }),
        ],
      }),
      // Accounts Signoff (Officer 36%, Date 32%, Signature 32%)
      new TableRow({
        height: { value: 330, rule: 'atLeast' },
        children: [
          cell('Accounts Officer:', { size: 20 }),
          cell('Date:', { size: 20 }),
          cell('Signature:', { size: 20 }),
        ],
      }),
    ],
  });
}

// Consolidated Approvals Table with expanded Date space (22%) and balanced Name (32%)
function approvalsTable() {
  const desks = [
    { title: '1. HOD APPROVAL' },
    { title: '2. HOSTEL ALLOCATION / ADMINISTRATION' },
    { title: '3. REGISTRAR APPROVAL' },
    { title: '4. PRINCIPAL APPROVAL' },
    { title: '5. MANAGING DIRECTOR APPROVAL' },
  ];

  const rows: TableRow[] = [
    // Main Header
    new TableRow({
      children: [
        new TableCell({
          borders,
          columnSpan: 4,
          shading: { fill: 'E8EEF5' },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 45, bottom: 45, left: 100, right: 100 },
          children: [
            line('CLEARANCE & APPROVAL DESKS', {
              bold: true,
              size: 20,
              after: 0,
            }),
          ],
        }),
      ],
    }),
  ];

  for (const desk of desks) {
    // Desk Sign-off Row: Desk (24%), Name (32%), Date (22%), Signature (22%)
    rows.push(
      new TableRow({
        height: { value: 330, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            children: [line(desk.title, { bold: true, size: 19, after: 0 })],
          }),
          cell('Name:', { size: 20 }),
          cell('Date:', { size: 20 }),
          cell('Signature:', { size: 20 }),
        ],
      }),
      // Comment Row
      new TableRow({
        height: { value: 330, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            columnSpan: 4,
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            children: [line('Comment:', { size: 20, after: 0 })],
          }),
        ],
      }),
    );
  }

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2400, 3200, 2200, 2200],
    rows,
  });
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
    spacer(),
  );

  // Distinct Accounts & Approvals Sections
  children.push(
    accountsBox(),
    spacer(),
    approvalsTable(),
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
            margin: { top: 380, right: 460, bottom: 380, left: 460 },
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
                    text: 'Print 1 copy for student records.',
                    font: FONT,
                    size: 15,
                    color: '64748B',
                    italics: true,
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
