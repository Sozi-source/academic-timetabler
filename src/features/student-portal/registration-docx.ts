import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
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
        size: options.size ?? 19,
        bold: options.bold ?? false,
        color: '0F172A',
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
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [
      line(value, {
        bold: options.bold,
        size: options.size ?? 19,
        align: options.align,
        after: 0,
      }),
    ],
  });
}

// Accounts Clearance block with standard readable typography
function accountsBox() {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 2500, 3000],
    rows: [
      // Shaded Header
      new TableRow({
        children: [
          new TableCell({
            borders,
            columnSpan: 3,
            shading: { fill: 'E8EEF5' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 90, right: 90 },
            children: [
              line('ACCOUNTS CLEARANCE', {
                bold: true,
                size: 19,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      // Balances
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          cell('Previous Balance: KShs', { size: 19 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 90, right: 90 },
            children: [line('Amount Paid: KShs', { size: 19, after: 0 })],
          }),
        ],
      }),
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          cell('Current Balance: KShs', { size: 19 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 90, right: 90 },
            children: [line('Hostel Fees: KShs', { size: 19, after: 0 })],
          }),
        ],
      }),
      // Accounts Signoff
      new TableRow({
        height: { value: 320, rule: 'atLeast' },
        children: [
          cell('Accounts Officer:', { size: 19 }),
          cell('Date:', { size: 19 }),
          cell('Signature:', { size: 19 }),
        ],
      }),
    ],
  });
}

// Consolidated Approvals Table with standard readable typography
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
          margins: { top: 40, bottom: 40, left: 90, right: 90 },
          children: [
            line('CLEARANCE & APPROVAL DESKS', {
              bold: true,
              size: 19,
              after: 0,
            }),
          ],
        }),
      ],
    }),
  ];

  for (const desk of desks) {
    // Desk Sign-off Row: Desk Title (26%), Officer Name (38%), Date (16%), Signature (20%)
    rows.push(
      new TableRow({
        height: { value: 320, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 45, bottom: 45, left: 90, right: 90 },
            children: [line(desk.title, { bold: true, size: 18, after: 0 })],
          }),
          cell('Name:', { size: 19 }),
          cell('Date:', { size: 19 }),
          cell('Signature:', { size: 19 }),
        ],
      }),
      // Comment Row
      new TableRow({
        height: { value: 320, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            columnSpan: 4,
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 45, bottom: 45, left: 90, right: 90 },
            children: [line('Comment:', { size: 19, after: 0 })],
          }),
        ],
      }),
    );
  }

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2600, 3800, 1600, 2000],
    rows,
  });
}

const spacer = () => new Paragraph({ spacing: { after: 30, line: 200 } });

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
            transformation: { width: 58, height: 44 },
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
      size: 19,
      align: AlignmentType.CENTER,
      after: 50,
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
          height: { value: 280, rule: 'atLeast' },
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true, size: 19 }),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true, size: 19 }),
          ],
        }),
        new TableRow({
          height: { value: 280, rule: 'atLeast' },
          children: [
            cell(`Course: ${context.student.programmeName}`, { size: 19 }),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? ''}`, { size: 19 }),
          ],
        }),
        new TableRow({
          height: { value: 280, rule: 'atLeast' },
          children: [
            cell(`Department: ${context.student.departmentName}`, { size: 19 }),
            cell(`Intake: ${context.student.cohortName ?? ''}`, { size: 19 }),
          ],
        }),
        new TableRow({
          height: { value: 280, rule: 'atLeast' },
          children: [
            cell(`Academic Period: ${context.period.name}`, { size: 19 }),
            cell('Resident:', { size: 19 }),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: 19,
      align: AlignmentType.CENTER,
      before: 40,
      after: 20,
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
          height: { value: 280, rule: 'atLeast' },
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5', size: 19 }),
            cell('Unit Code', { bold: true, shading: 'E8EEF5', size: 19 }),
            cell('Unit Name', { bold: true, shading: 'E8EEF5', size: 19 }),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 280, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER, size: 19 }),
              cell(unit.unitCode, { bold: true, size: 19 }),
              cell(unit.unitName, { size: 19 }),
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
    new Paragraph({ spacing: { after: 15, line: 200 } }),
    line('Print 1 copy for student records.', {
      bold: true,
      size: 18,
      align: AlignmentType.CENTER,
      before: 20,
      after: 0,
    }),
  );

  const document = new Document({
    creator: 'Imperial College of Medical and Health Sciences',
    title: `${context.student.admissionNumber} Unit Registration`,
    description: 'Continuing student unit registration form',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 19 },
          paragraph: { spacing: { line: 200, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 360, right: 450, bottom: 360, left: 450 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
