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
const PRIMARY_COLOR = '033B36';

const borderThin = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '64748B',
} as const;

const tableBorders = {
  top: borderThin,
  bottom: borderThin,
  left: borderThin,
  right: borderThin,
  insideHorizontal: borderThin,
  insideVertical: borderThin,
} as const;

function p(
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
      line: 200,
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 16,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
        color: options.color ?? '000000',
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  options: {
    width?: number;
    bgColor?: string;
    colSpan?: number;
    borders?: typeof tableBorders;
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    vAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
  } = {},
) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    columnSpan: options.colSpan ?? 1,
    verticalAlign: options.vAlign ?? VerticalAlign.CENTER,
    shading: options.bgColor ? { fill: options.bgColor } : undefined,
    borders: options.borders ?? tableBorders,
    margins: {
      top: options.margins?.top ?? 25,
      bottom: options.margins?.bottom ?? 25,
      left: options.margins?.left ?? 60,
      right: options.margins?.right ?? 60,
    },
    children,
  });
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

  let logo: Buffer | null = null;
  try {
    logo = await readFile(
      path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'),
    );
  } catch {
    logo = null;
  }

  const children: Array<Paragraph | Table> = [];

  // 1. HEADER SECTION
  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 10 },
        children: [
          new ImageRun({
            data: logo,
            type: 'png',
            transformation: { width: 48, height: 34 },
          }),
        ],
      }),
    );
  }

  children.push(
    p('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
      bold: true,
      size: 20,
      align: AlignmentType.CENTER,
      color: PRIMARY_COLOR,
      after: 6,
    }),
    p('OFFICE OF THE REGISTRAR (ACADEMIC AFFAIRS)', {
      bold: true,
      size: 14,
      align: AlignmentType.CENTER,
      color: '475569',
      after: 6,
    }),
    p('CONTINUING STUDENT UNIT REGISTRATION FORM', {
      bold: true,
      size: 16,
      align: AlignmentType.CENTER,
      color: PRIMARY_COLOR,
      after: 30,
    }),
  );

  // Total Printable Width = 11906 - (800 * 2) = 10306 dxa
  const TOTAL_WIDTH = 10306;
  const HALF_WIDTH = Math.floor(TOTAL_WIDTH / 2); // 5153 dxa

  // 2. STUDENT PARTICULAR BOX (2-Column Key Value Grid)
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: TOTAL_WIDTH, type: WidthType.DXA },
      columnWidths: [HALF_WIDTH, HALF_WIDTH],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            cell([p(`Student Name: ${context.student.fullName}`, { bold: true, after: 0 })], { width: HALF_WIDTH }),
            cell([p(`Admission No: ${context.student.admissionNumber}`, { bold: true, after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p(`Course: ${context.student.programmeName}`, { after: 0 })], { width: HALF_WIDTH }),
            cell([p(`Stage: ${context.student.stageCode ?? context.student.stageName ?? 'N/A'}`, { after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p(`Department: ${context.student.departmentName}`, { after: 0 })], { width: HALF_WIDTH }),
            cell([p(`Intake: ${context.student.cohortName ?? 'N/A'}`, { after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p(`Academic Period: ${context.period.name}`, { after: 0 })], { width: HALF_WIDTH }),
            cell([p('Residential Status: Resident / Non-Resident', { after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 30 } }),
  );

  // 3. REGISTERED UNITS OVERVIEW (2-COLUMN PARALLEL GRID)
  const halfCount = Math.ceil(units.length / 2);
  const leftUnits = units.slice(0, halfCount);
  const rightUnits = units.slice(halfCount);

  // Columns: Left S/N (650), Left Code (1550), Left Title (2953), Right S/N (650), Right Code (1550), Right Title (2953)
  const c1 = 650;
  const c2 = 1550;
  const c3 = 2953;

  const unitTableRows: TableRow[] = [
    new TableRow({
      cantSplit: true,
      children: [
        cell(
          [p(`REGISTERED UNITS OVERVIEW (${units.length} UNITS)`, { bold: true, color: 'FFFFFF', align: AlignmentType.CENTER, size: 15, after: 0 })],
          { width: TOTAL_WIDTH, colSpan: 6, bgColor: PRIMARY_COLOR, margins: { top: 25, bottom: 25, left: 60, right: 60 } },
        ),
      ],
    }),
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        cell([p('S/N', { bold: true, align: AlignmentType.CENTER, after: 0, size: 14 })], { width: c1, bgColor: 'F1F5F9' }),
        cell([p('Code', { bold: true, after: 0, size: 14 })], { width: c2, bgColor: 'F1F5F9' }),
        cell([p('Unit Name', { bold: true, after: 0, size: 14 })], { width: c3, bgColor: 'F1F5F9' }),
        cell([p('S/N', { bold: true, align: AlignmentType.CENTER, after: 0, size: 14 })], { width: c1, bgColor: 'F1F5F9' }),
        cell([p('Code', { bold: true, after: 0, size: 14 })], { width: c2, bgColor: 'F1F5F9' }),
        cell([p('Unit Name', { bold: true, after: 0, size: 14 })], { width: c3, bgColor: 'F1F5F9' }),
      ],
    }),
  ];

  for (let i = 0; i < halfCount; i++) {
    const left = leftUnits[i];
    const right = rightUnits[i];
    unitTableRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell([p(String(i + 1), { align: AlignmentType.CENTER, after: 0, size: 14 })], { width: c1 }),
          cell([p(left.unitCode, { bold: true, after: 0, size: 14 })], { width: c2 }),
          cell([p(left.unitName, { after: 0, size: 14 })], { width: c3 }),
          cell([p(right ? String(i + halfCount + 1) : '', { align: AlignmentType.CENTER, after: 0, size: 14 })], { width: c1 }),
          cell([p(right ? right.unitCode : '', { bold: true, after: 0, size: 14 })], { width: c2 }),
          cell([p(right ? right.unitName : '', { after: 0, size: 14 })], { width: c3 }),
        ],
      }),
    );
  }

  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: TOTAL_WIDTH, type: WidthType.DXA },
      columnWidths: [c1, c2, c3, c1, c2, c3],
      rows: unitTableRows,
    }),
    new Paragraph({ spacing: { after: 30 } }),
  );

  // 4. ACCOUNTS CLEARANCE CARD
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: TOTAL_WIDTH, type: WidthType.DXA },
      columnWidths: [HALF_WIDTH, HALF_WIDTH],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            cell(
              [p('1. ACCOUNTS CLEARANCE', { bold: true, color: PRIMARY_COLOR, size: 14, after: 0 })],
              { width: TOTAL_WIDTH, colSpan: 2, bgColor: 'F1F5F9' },
            ),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p('Previous balance: KShs _______________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
            cell([p('Amount paid: KShs __________________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p('Balance: KShs ______________________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
            cell([p('Hostel fees: KShs ____________________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p('Date: ______________________________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
            cell([p('Signature: _________________________________', { size: 14, after: 0 })], { width: HALF_WIDTH }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 24 } }),
  );

  // 5. FIVE APPROVAL CARDS (HOD, HOSTEL, REGISTRAR, PRINCIPAL, MANAGING DIRECTOR)
  const makeOfficialApprovalCard = (
    sectionNum: number,
    title: string,
    approverLabel: string,
  ) => {
    const LEFT_COL = 6183;
    const RIGHT_COL = 4123;

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: TOTAL_WIDTH, type: WidthType.DXA },
      columnWidths: [LEFT_COL, RIGHT_COL],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            cell(
              [p(`${sectionNum}. ${title}`, { bold: true, color: PRIMARY_COLOR, size: 14, after: 0 })],
              { width: TOTAL_WIDTH, colSpan: 2, bgColor: 'F1F5F9' },
            ),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p(approverLabel, { bold: true, size: 14, after: 0 })], { width: LEFT_COL }),
            cell([p('Date: ________________________', { size: 14, after: 0 })], { width: RIGHT_COL }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            cell([p('Comment: _______________________________________________', { size: 14, after: 0 })], { width: LEFT_COL }),
            cell([p('Signature: ___________________', { size: 14, after: 0 })], { width: RIGHT_COL }),
          ],
        }),
      ],
    });
  };

  const officialCards = [
    { num: 2, title: 'HOD APPROVAL', label: 'Approved/not approved by: HOD:' },
    { num: 3, title: 'HOSTEL ALLOCATION', label: 'Administrator:' },
    { num: 4, title: 'REGISTRAR APPROVAL', label: 'REGISTRAR:' },
    { num: 5, title: 'PRINCIPAL APPROVAL', label: 'PRINCIPAL:' },
    { num: 6, title: 'MANAGING DIRECTOR APPROVAL', label: 'MANAGING DIRECTOR:' },
  ];

  for (const card of officialCards) {
    children.push(
      makeOfficialApprovalCard(card.num, card.title, card.label),
      new Paragraph({ spacing: { after: 20 } }),
    );
  }

  const document = new Document({
    creator: 'Imperial College of Medical and Health Sciences',
    title: `${context.student.admissionNumber} Unit Registration Form`,
    description: 'Official continuing student unit registration clearance document',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 16, color: '000000' },
          paragraph: { spacing: { line: 200, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 800, right: 800, bottom: 800, left: 800 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 0 },
                children: [
                  new TextRun({
                    text: 'Form Ref: ICMHS/REG/2026/0482  |  This form should be filled in one copy and filed at the Registrar of Students.',
                    font: FONT,
                    size: 13,
                    color: '475569',
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
