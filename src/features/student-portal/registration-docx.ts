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
  color: '000000',
} as const;
const borders = { top: border, bottom: border, left: border, right: border } as const;

/**
 * The form is calibrated to guarantee MAX 1 page even for 8 to 12 registered units.
 * Row heights, font sizes, and card padding dynamically scale based on exact unit load.
 */
const MIN_SCALE_UNITS = 6;
const MAX_SCALE_UNITS = 10;

function lerp(spacious: number, compact: number, t: number): number {
  return Math.round(spacious + (compact - spacious) * t);
}

interface FormMetrics {
  fontSize: number;
  headerFontSize: number;
  particularsRowHeight: number;
  particularsCellMargin: number;
  unitsHeadingBefore: number;
  unitsHeadingAfter: number;
  unitRowHeight: number;
  postUnitsTableSpacing: number;
  signOffHeadingHeight: number;
  signOffHeadingMargin: number;
  signOffDateRowHeight: number;
  signOffCommentRowHeight: number;
  signOffCellMargin: number;
  signOffSpacerAfter: number;
}

function computeFormMetrics(unitCount: number): FormMetrics {
  const t = Math.min(
    1,
    Math.max(0, (unitCount - MIN_SCALE_UNITS) / (MAX_SCALE_UNITS - MIN_SCALE_UNITS)),
  );

  return {
    fontSize: lerp(18.5, 16, t),
    headerFontSize: lerp(23, 20, t),
    particularsRowHeight: lerp(280, 190, t),
    particularsCellMargin: lerp(46, 24, t),
    unitsHeadingBefore: lerp(24, 12, t),
    unitsHeadingAfter: lerp(16, 6, t),
    unitRowHeight: lerp(280, 190, t),
    postUnitsTableSpacing: lerp(30, 14, t),
    signOffHeadingHeight: lerp(215, 160, t),
    signOffHeadingMargin: lerp(38, 22, t),
    signOffDateRowHeight: lerp(370, 225, t),
    signOffCommentRowHeight: lerp(380, 225, t),
    signOffCellMargin: lerp(58, 28, t),
    signOffSpacerAfter: lerp(120, 40, t),
  };
}

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
      after: options.after ?? 10,
      line: 205,
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 17.5,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
        color: options.color ?? '000000',
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
  } = {},
  metrics?: FormMetrics,
) {
  return new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: metrics?.particularsCellMargin ?? 36,
      bottom: metrics?.particularsCellMargin ?? 36,
      left: 85,
      right: 85,
    },
    children: [
      line(value, {
        bold: options.bold,
        size: options.size ?? metrics?.fontSize ?? 17.5,
        align: options.align,
        after: 0,
        color: '000000',
      }),
    ],
  });
}

const signOffBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '000000',
} as const;
const signOffBorders = { top: signOffBorder, bottom: signOffBorder, left: signOffBorder, right: signOffBorder } as const;

function signOffSpacer(metrics: FormMetrics) {
  return new Paragraph({ spacing: { after: metrics.signOffSpacerAfter, line: 30 } });
}

function signOffText(
  text: string,
  options: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
  metrics?: FormMetrics,
) {
  return line(text, {
    bold: options.bold,
    color: options.color ?? '000000',
    size: options.size ?? (metrics ? metrics.fontSize - 2 : 15.5),
    align: options.align,
    after: 0,
  });
}

function signOffLabelCell(label: string, metrics: FormMetrics) {
  return new TableCell({
    borders: signOffBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: metrics.signOffCellMargin, bottom: metrics.signOffCellMargin, left: 95, right: 70 },
    children: [signOffText(label, { bold: true, color: '000000' }, metrics)],
  });
}

function signOffWriteCell(metrics: FormMetrics) {
  return new TableCell({
    borders: signOffBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: metrics.signOffCellMargin, bottom: metrics.signOffCellMargin, left: 75, right: 95 },
    children: [signOffText('', { color: '000000' }, metrics)],
  });
}

function signOffHeading(title: string, metrics: FormMetrics) {
  return new TableCell({
    borders: signOffBorders,
    columnSpan: 4,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: metrics.signOffHeadingMargin, bottom: metrics.signOffHeadingMargin, left: 95, right: 95 },
    children: [signOffText(title, { bold: true, color: '000000', size: metrics.fontSize - 1 }, metrics)],
  });
}

function approvalCard(title: string, approverLabel: string, metrics: FormMetrics) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2100, 3900, 1100, 2900],
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffHeadingHeight, rule: 'atLeast' },
        children: [signOffHeading(title, metrics)],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffDateRowHeight, rule: 'atLeast' },
        children: [
          signOffLabelCell(approverLabel, metrics),
          signOffWriteCell(metrics),
          signOffLabelCell('Date', metrics),
          signOffWriteCell(metrics),
        ],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffCommentRowHeight, rule: 'atLeast' },
        children: [
          signOffLabelCell('Comment', metrics),
          signOffWriteCell(metrics),
          signOffLabelCell('Signature', metrics),
          signOffWriteCell(metrics),
        ],
      }),
    ],
  });
}

function accountsClearanceCard(metrics: FormMetrics) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2300, 2700, 1900, 3100],
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffHeadingHeight, rule: 'atLeast' },
        children: [signOffHeading('ACCOUNTS.', metrics)],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffDateRowHeight, rule: 'atLeast' },
        children: [
          signOffLabelCell('Previous balance: KShs', metrics),
          signOffWriteCell(metrics),
          signOffLabelCell('Amount paid', metrics),
          signOffWriteCell(metrics),
        ],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffDateRowHeight, rule: 'atLeast' },
        children: [
          signOffLabelCell('Balance: KShs', metrics),
          signOffWriteCell(metrics),
          signOffLabelCell('Hostel fees', metrics),
          signOffWriteCell(metrics),
        ],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: metrics.signOffDateRowHeight, rule: 'atLeast' },
        children: [
          signOffLabelCell('Date', metrics),
          signOffWriteCell(metrics),
          signOffLabelCell('Signature', metrics),
          signOffWriteCell(metrics),
        ],
      }),
    ],
  });
}

function premiumSignOffSection(metrics: FormMetrics): Array<Paragraph | Table> {
  const cards = [
    approvalCard('HOD APPROVAL', 'Approved/not approved by: HOD:', metrics),
    approvalCard('HOSTEL ALLOCATION.', 'Administrator:', metrics),
    approvalCard('REGISTRAR APPROVAL', 'REGISTRAR:', metrics),
    approvalCard('PRINCIPAL APPROVAL', 'PRINCIPAL:', metrics),
    approvalCard('MANAGING DIRECTOR APPROVAL', 'MANAGING DIRECTOR:', metrics),
  ];

  return [
    accountsClearanceCard(metrics),
    ...cards.flatMap((card) => [signOffSpacer(metrics), card]),
  ];
}

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

  const metrics = computeFormMetrics(units.length);

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
        spacing: { after: 12 },
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
      size: metrics.headerFontSize,
      align: AlignmentType.CENTER,
      after: 8,
    }),
    line('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: metrics.headerFontSize - 3,
      align: AlignmentType.CENTER,
      after: 18,
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
          height: { value: metrics.particularsRowHeight, rule: 'atLeast' },
          children: [
            cell(`Name: ${context.student.fullName}`, { bold: true, size: metrics.fontSize }, metrics),
            cell(`Admission No: ${context.student.admissionNumber}`, { bold: true, size: metrics.fontSize }, metrics),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: metrics.particularsRowHeight, rule: 'atLeast' },
          children: [
            cell(`Course: ${context.student.programmeName}`, { size: metrics.fontSize }, metrics),
            cell(`Stage: ${context.student.stageCode ?? context.student.stageName ?? ''}`, { size: metrics.fontSize }, metrics),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: metrics.particularsRowHeight, rule: 'atLeast' },
          children: [
            cell(`Department: ${context.student.departmentName}`, { size: metrics.fontSize }, metrics),
            cell(`Intake: ${context.student.cohortName ?? ''}`, { size: metrics.fontSize }, metrics),
          ],
        }),
        new TableRow({
          cantSplit: true,
          height: { value: metrics.particularsRowHeight, rule: 'atLeast' },
          children: [
            cell(`Academic Period: ${context.period.name}`, { size: metrics.fontSize }, metrics),
            cell('Resident:', { size: metrics.fontSize }, metrics),
          ],
        }),
      ],
    }),
    line('REGISTERED UNITS', {
      bold: true,
      size: metrics.fontSize,
      align: AlignmentType.CENTER,
      before: metrics.unitsHeadingBefore,
      after: metrics.unitsHeadingAfter,
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
          height: { value: metrics.unitRowHeight, rule: 'atLeast' },
          children: [
            cell('S/No.', { bold: true, align: AlignmentType.CENTER, size: metrics.fontSize }, metrics),
            cell('Unit Code', { bold: true, size: metrics.fontSize }, metrics),
            cell('Unit Name', { bold: true, size: metrics.fontSize }, metrics),
          ],
        }),
        ...units.map((unit, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: metrics.unitRowHeight, rule: 'atLeast' },
            children: [
              cell(String(index + 1), { align: AlignmentType.CENTER, size: metrics.fontSize }, metrics),
              cell(unit.unitCode, { bold: true, size: metrics.fontSize }, metrics),
              cell(unit.unitName, { size: metrics.fontSize }, metrics),
            ],
          }),
        ),
      ],
    }),
  );

  children.push(
    new Paragraph({ spacing: { after: metrics.postUnitsTableSpacing, line: 20 } }),
    ...premiumSignOffSection(metrics),
  );

  const document = new Document({
    creator: 'Imperial College of Medical and Health Sciences',
    title: `${context.student.admissionNumber} Unit Registration`,
    description: 'Continuing student unit registration form',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: metrics.fontSize, color: '000000' },
          paragraph: { spacing: { line: 200, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 180, right: 280, bottom: 160, left: 280 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 8, after: 0 },
                children: [
                  new TextRun({
                    text: 'This form should be filled in one copy and filed at the Registrar of Students.',
                    font: FONT,
                    size: 13,
                    color: '000000',
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
