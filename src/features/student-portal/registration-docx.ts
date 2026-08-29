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
      after: options.after ?? 40,
      line: 240,
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
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shading?: string;
  } = {},
) {
  return new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.shading ? { fill: options.shading } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: [
      line(value, {
        bold: options.bold,
        size: 17.5,
        align: options.align,
        after: 0,
      }),
    ],
  });
}

function approvalBox(title: string) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [10000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            shading: { fill: 'F1F5F9' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            children: [
              line(title, {
                bold: true,
                size: 17.5,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              line(
                'Name: _______________________________   Date: ___________________   Signature: ___________________',
                { size: 17, after: 40 },
              ),
              line(
                'Comment: ____________________________________________________________________________________',
                { size: 17, after: 0 },
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

function accountsBox() {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5000, 5000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            columnSpan: 2,
            shading: { fill: 'F1F5F9' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            children: [
              line('ACCOUNTS CLEARANCE', {
                bold: true,
                size: 17.5,
                after: 0,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          cell('Previous Balance: KShs ____________________'),
          cell('Amount Paid: KShs ____________________'),
        ],
      }),
      new TableRow({
        children: [
          cell('Current Balance: KShs ____________________'),
          cell('Hostel Fees: KShs ____________________'),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders,
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              line(
                'Accounts Officer: __________________________   Date: __________________   Signature: __________________',
                { size: 17, after: 0 },
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

const spacer = () => new Paragraph({ spacing: { after: 70 } });

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
        spacing: { after: 40 },
        children: [
          new ImageRun({
            data: logo,
            type: 'png',
            transformation: { width: 72, height: 53 },
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
      after: 30,
    }),
    line('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: 21,
      align: AlignmentType.CENTER,
      after: 25,
    }),
    line(context.student.programmeName.toUpperCase(), {
      bold: true,
      size: 19,
      align: AlignmentType.CENTER,
      after: 100,
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
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true }),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true }),
          ],
        }),
        new TableRow({
          children: [
            cell(`Course: ${context.student.programmeName}`),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? '________________'}`),
          ],
        }),
        new TableRow({
          children: [
            cell(`Department: ${context.student.departmentName}`),
            cell(`Intake: ${context.student.cohortName ?? '________________'}`),
          ],
        }),
        new TableRow({
          children: [
            cell(`Academic Period: ${context.period.name}`),
            cell('Resident: ______________________________'),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: 19,
      align: AlignmentType.CENTER,
      before: 120,
      after: 60,
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
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, shading: 'E8EEF5' }),
            cell('Unit Code', { bold: true, shading: 'E8EEF5' }),
            cell('Unit Name', { bold: true, shading: 'E8EEF5' }),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER }),
              cell(unit.unitCode, { bold: true }),
              cell(unit.unitName),
            ],
          }),
        ),
      ],
    }),
    spacer(),
  );

  // Distinct Approvals Sections
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
    spacer(),
    line('Print 1 copy for student records.', {
      bold: true,
      size: 17,
      align: AlignmentType.CENTER,
      before: 80,
    }),
  );

  const document = new Document({
    creator: 'Imperial College of Medical and Health Sciences',
    title: `${context.student.admissionNumber} Unit Registration`,
    description: 'Continuing student unit registration form',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 18 },
          paragraph: { spacing: { line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 480, right: 500, bottom: 480, left: 500 },
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
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
