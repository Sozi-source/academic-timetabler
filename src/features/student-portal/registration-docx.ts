import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import type { StudentPortalRegistrationContext } from './types';

const border = { style: BorderStyle.SINGLE, size: 4, color: '444444' } as const;
const borders = { top: border, bottom: border, left: border, right: border } as const;

function stageLabel(periodNumber: number) {
  const year = Math.ceil(periodNumber / 2);
  const semester = periodNumber % 2 === 0 ? 2 : 1;
  return `Y${year}S${semester}`;
}

function line(label: string, value = '') {
  return new Paragraph({
    spacing: { after: 90 },
    children: [new TextRun({ bold: true, text: `${label}: ` }), new TextRun(value || '________________________________')],
  });
}

function approvalSection(title: string, firstLabel: string) {
  return [
    new Paragraph({ spacing: { before: 130, after: 80 }, children: [new TextRun({ bold: true, text: title })] }),
    new Paragraph({ children: [new TextRun(`${firstLabel}: _______________________________________     Date: ______________________`)] }),
    new Paragraph({ spacing: { after: 100 }, children: [new TextRun('Comment: __________________________________________     Signature: __________________')] }),
  ];
}

export async function buildStudentUnitRegistrationDocx(context: StudentPortalRegistrationContext) {
  const logoPath = path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.jpeg');
  const logo = await readFile(logoPath);
  const selectedUnits = context.units.filter((unit) => unit.selected);

  const logoCell = () => new TableCell({
    width: { size: 1300, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logo, transformation: { width: 76, height: 58 }, type: 'jpg' })] })],
  });

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [1300, 7000, 1300],
    rows: [new TableRow({ children: [
      logoCell(),
      new TableCell({
        width: { size: 7000, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 24, text: 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 22, text: 'STUDENT UNIT REGISTRATION FORM' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 21, text: context.student.programmeName.toUpperCase() })] }),
        ],
      }),
      logoCell(),
    ] })],
  });

  const unitRows = selectedUnits.map((unit, index) => new TableRow({
    children: [
      new TableCell({ width: { size: 700, type: WidthType.DXA }, borders, children: [new Paragraph({ alignment: AlignmentType.CENTER, text: String(index + 1) })] }),
      new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders, children: [new Paragraph(unit.unitCode)] }),
      new TableCell({ width: { size: 6500, type: WidthType.DXA }, borders, children: [new Paragraph(unit.unitName)] }),
    ],
  }));

  const unitsTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [700, 1800, 6500],
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ borders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, text: 'S/NO.' })] })] }),
        new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ bold: true, text: 'Unit code' })] })] }),
        new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ bold: true, text: 'Unit name' })] })] }),
      ] }),
      ...unitRows,
    ],
  });

  const doc = new Document({
    creator: context.student.departmentName,
    title: `Unit Registration - ${context.student.admissionNumber}`,
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 22 }, paragraph: { spacing: { after: 80, line: 276 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 600, right: 650, bottom: 600, left: 650 } } },
      children: [
        headerTable,
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '222222' } }, spacing: { after: 150 } }),
        line('Name', context.student.fullName),
        new Paragraph({ children: [
          new TextRun({ bold: true, text: 'Admission No: ' }), new TextRun(context.student.admissionNumber),
          new TextRun({ bold: true, text: '     Stage: ' }), new TextRun(stageLabel(context.student.academicPeriodNumber)),
        ] }),
        line('Course', context.student.programmeName),
        new Paragraph({ children: [
          new TextRun({ bold: true, text: 'Department: ' }), new TextRun(context.student.departmentName),
          new TextRun({ bold: true, text: '     Intake: ' }), new TextRun(context.student.cohortName),
        ] }),
        line('Resident'),
        new Paragraph({ spacing: { before: 140, after: 80 }, children: [new TextRun({ bold: true, text: 'UNIT REGISTRATION' })] }),
        unitsTable,
        new Paragraph({ spacing: { before: 140, after: 70 }, children: [new TextRun({ bold: true, text: 'ACCOUNTS' })] }),
        new Paragraph('Previous balance: KShs __________________________     Amount Paid: __________________________'),
        new Paragraph('Balance: KShs _________________________________     Hostel Fees: ___________________________'),
        new Paragraph({ spacing: { after: 100 }, text: 'Date: ________________________________________     Signature: _____________________________' }),
        ...approvalSection('HOD APPROVAL', 'Approved / Not approved by HOD'),
        ...approvalSection('HOSTEL ALLOCATION', 'Administrator'),
        ...approvalSection('REGISTRAR', 'Registrar'),
        ...approvalSection('PRINCIPAL', 'Principal'),
        ...approvalSection('MANAGING DIRECTOR', 'Managing Director'),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
