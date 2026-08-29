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
      after: options.after ?? 25,
      line: 210,
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 16,
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
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      line(value, {
        bold: options.bold,
        size: options.size ?? 16,
        align: options.align,
        after: 0,
      }),
    ],
  });
}

// 3-column structured approval block: Name (45%), Date (25%), Signature (30%)
function approvalBox(title: string) {
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
            shading: { fill: 'F1F5F9' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              line(title, {
                bold: true,
                size: 15.5,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      // Row 1: Name, Date, Signature with balanced dedicated widths
      new TableRow({
        height: { value: 280, rule: 'atLeast' },
        children: [
          cell('Name:', { size: 15.5 }),
          cell('Date:', { size: 15.5 }),
          cell('Signature:', { size: 15.5 }),
        ],
      }),
      // Row 2: Full-width Comment
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          new TableCell({
            borders,
            columnSpan: 3,
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              line('Comment:', {
                size: 15.5,
                after: 0,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Accounts Clearance block
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
            shading: { fill: 'F1F5F9' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              line('ACCOUNTS CLEARANCE', {
                bold: true,
                size: 15.5,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      // Balances
      new TableRow({
        height: { value: 260, rule: 'atLeast' },
        children: [
          cell('Previous Balance: KShs', { size: 15.5 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [line('Amount Paid: KShs', { size: 15.5, after: 0 })],
          }),
        ],
      }),
      new TableRow({
        height: { value: 260, rule: 'atLeast' },
        children: [
          cell('Current Balance: KShs', { size: 15.5 }),
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [line('Hostel Fees: KShs', { size: 15.5, after: 0 })],
          }),
        ],
      }),
      // Accounts Signoff (Name 45%, Date 25%, Sign 30%)
      new TableRow({
        height: { value: 280, rule: 'atLeast' },
        children: [
          cell('Accounts Officer:', { size: 15.5 }),
          cell('Date:', { size: 15.5 }),
          cell('Signature:', { size: 15.5 }),
        ],
      }),
    ],
  });
}

const spacer = () => new Paragraph({ spacing: { after: 35, line: 200 } });

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
            transformation: { width: 56, height: 42 },
          }),
        ],
      }),
    );
  }

  children.push(
    line('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
      bold: true,
      size: 21,
      align: AlignmentType.CENTER,
      after: 15,
    }),
    line('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: 18.5,
      align: AlignmentType.CENTER,
      after: 15,
    }),
    line(context.student.programmeName.toUpperCase(), {
      bold: true,
      size: 16.5,
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
          height: { value: 240, rule: 'atLeast' },
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true, size: 15.5 }),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true, size: 15.5 }),
          ],
        }),
        new TableRow({
          height: { value: 240, rule: 'atLeast' },
          children: [
            cell(`Course: ${context.student.programmeName}`, { size: 15.5 }),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? ''}`, { size: 15.5 }),
          ],
        }),
        new TableRow({
          height: { value: 240, rule: 'atLeast' },
          children: [
            cell(`Department: ${context.student.departmentName}`, { size: 15.5 }),
            cell(`Intake: ${context.student.cohortName ?? ''}`, { size: 15.5 }),
          ],
        }),
        new TableRow({
          height: { value: 240, rule: 'atLeast' },
          children: [
            cell(`Academic Period: ${context.period.name}`, { size: 15.5 }),
            cell('Resident:', { size: 15.5 }),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: 16,
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
          height: { value: 240, rule: 'atLeast' },
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5', size: 15 }),
            cell('Unit Code', { bold: true, shading: 'E8EEF5', size: 15 }),
            cell('Unit Name', { bold: true, shading: 'E8EEF5', size: 15 }),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: 240, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER, size: 15 }),
              cell(unit.unitCode, { bold: true, size: 15 }),
              cell(unit.unitName, { size: 15 }),
            ],
          }),
        ),
      ],
    }),
    spacer(),
  );

  // Distinct Approvals Sections (Fits 1 page)
  children.push(
    accountsBox(),
    spacer(),
    approvalBox('HOD APPROVAL'),
    spacer(),
    approvalBox('HOSTEL ALLOCATION / ADMINISTRATION'),
    spacer(),
    approvalBox('REGISTRAR APPROVAL'),
    spacer(),
    approvalBox('PRINCIPAL APPROVAL'),
    spacer(),
    approvalBox('MANAGING DIRECTOR APPROVAL'),
    new Paragraph({ spacing: { after: 20, line: 200 } }),
    line('Print 1 copy for student records.', {
      bold: true,
      size: 15,
      align: AlignmentType.CENTER,
      before: 30,
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
          run: { font: FONT, size: 16 },
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
