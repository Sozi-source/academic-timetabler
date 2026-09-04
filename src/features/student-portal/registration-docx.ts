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
      after: options.after ?? 15,
      line: 210,
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 18,
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
    margins: { top: 35, bottom: 35, left: 80, right: 80 },
    children: [
      line(value, {
        bold: options.bold,
        size: options.size ?? 18,
        align: options.align,
        after: 0,
      }),
    ],
  });
}

// Accounts Clearance Box (Compact, fits 1 page)
function accountsBox() {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 3200, 3200],
    rows: [
      // Shaded Header
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders,
            columnSpan: 3,
            shading: { fill: 'E8EEF5' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              line('ACCOUNTS CLEARANCE', {
                bold: true,
                size: 18,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      // Balances
      new TableRow({
        cantSplit: true,
        height: { value: 240, rule: 'atLeast' },
        children: [
          cell('Previous Balance: KShs', { size: 17.5 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 35, bottom: 35, left: 80, right: 80 },
            children: [line('Amount Paid: KShs', { size: 17.5, after: 0 })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: 240, rule: 'atLeast' },
        children: [
          cell('Current Balance: KShs', { size: 17.5 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 35, bottom: 35, left: 80, right: 80 },
            children: [line('Hostel Fees: KShs', { size: 17.5, after: 0 })],
          }),
        ],
      }),
      // Accounts Signoff
      new TableRow({
        cantSplit: true,
        height: { value: 250, rule: 'atLeast' },
        children: [
          cell('Accounts Officer:', { size: 17.5 }),
          cell('Date:', { size: 17.5 }),
          cell('Signature:', { size: 17.5 }),
        ],
      }),
    ],
  });
}

// Consolidated Clearance & Approval Desks Table (Compact, guaranteed 1 page)
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
      cantSplit: true,
      children: [
        new TableCell({
          borders,
          columnSpan: 4,
          shading: { fill: 'E8EEF5' },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: [
            line('CLEARANCE & APPROVAL DESKS', {
              bold: true,
              size: 18,
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
        cantSplit: true,
        height: { value: 250, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 35, bottom: 35, left: 80, right: 80 },
            children: [line(desk.title, { bold: true, size: 17, after: 0 })],
          }),
          cell('Name:', { size: 17.5 }),
          cell('Date:', { size: 17.5 }),
          cell('Signature:', { size: 17.5 }),
        ],
      }),
      // Comment Row
      new TableRow({
        cantSplit: true,
        height: { value: 250, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            columnSpan: 4,
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 35, bottom: 35, left: 80, right: 80 },
            children: [line('Comment:', { size: 17.5, after: 0 })],
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

const spacer = () => new Paragraph({ spacing: { after: 35, line: 160 } });

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
        spacing: { after: 15 },
        children: [
          new ImageRun({
            data: logo,
            type: 'png',
            transformation: { width: 52, height: 39 },
          }),
        ],
      }),
    );
  }

  children.push(
    line('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
      bold: true,
      size: 22,
      align: AlignmentType.CENTER,
      after: 10,
    }),
    line('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: 19,
      align: AlignmentType.CENTER,
      after: 10,
    }),
    line(context.student.programmeName.toUpperCase(), {
      bold: true,
      size: 17.5,
      align: AlignmentType.CENTER,
      after: 35,
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
          cantSplit: true,
          height: { value: 230, rule: 'atLeast' },
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true, size: 17.5 }),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true, size: 17.5 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: 230, rule: 'atLeast' },
          children: [
            cell(`Course: ${context.student.programmeName}`, { size: 17.5 }),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? ''}`, { size: 17.5 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: 230, rule: 'atLeast' },
          children: [
            cell(`Department: ${context.student.departmentName}`, { size: 17.5 }),
            cell(`Intake: ${context.student.cohortName ?? ''}`, { size: 17.5 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: 230, rule: 'atLeast' },
          children: [
            cell(`Academic Period: ${context.period.name}`, { size: 17.5 }),
            cell('Resident:', { size: 17.5 }),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: 18,
      align: AlignmentType.CENTER,
      before: 30,
      after: 15,
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
          cantSplit: true,
          height: { value: 230, rule: 'atLeast' },
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5', size: 17.5 }),
            cell('Unit Code', { bold: true, shading: 'E8EEF5', size: 17.5 }),
            cell('Unit Name', { bold: true, shading: 'E8EEF5', size: 17.5 }),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 230, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER, size: 17.5 }),
              cell(unit.unitCode, { bold: true, size: 17.5 }),
              cell(unit.unitName, { size: 17.5 }),
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
          run: { font: FONT, size: 18 },
          paragraph: { spacing: { line: 200, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 300, right: 380, bottom: 300, left: 380 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 0 },
                children: [
                  new TextRun({
                    text: 'This form should be filled in one copy and filed at the Registrar of Students.',
                    font: FONT,
                    size: 14,
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
