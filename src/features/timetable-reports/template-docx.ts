import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

import { getMasterSessionPresentation } from './master-presentation';
import type {
  TimetableReportGroup,
  TimetableReportRow,
  TimetableReportsData,
} from './types';

const INSTITUTION_NAME = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// docx swaps explicit dimensions when landscape orientation is requested.
const PAGE_WIDTH_DXA = 12_240;
const PAGE_HEIGHT_DXA = 15_840;
const PAGE_MARGIN_DXA = 720;
const TABLE_WIDTH_DXA = 14_280;
const TABLE_INDENT_DXA = 120;
const COLUMN_WIDTHS = [1_200, 2_100, 3_660, 3_660, 3_660] as const;
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 } as const;
const PERSONAL_PAGE_WIDTH_DXA = 12_240;
const PERSONAL_PAGE_HEIGHT_DXA = 15_840;
const PERSONAL_PAGE_MARGIN_DXA = 864;
const PERSONAL_TABLE_WIDTH_DXA = 10_392;
const PERSONAL_COLUMN_WIDTHS = [1_200, 3_064, 3_064, 3_064] as const;

const standardSlots = [
  { label: '8:00 AM - 10:00 AM', startsAt: '08:00', endsAt: '10:00' },
  { label: '10:30 AM - 12:30 PM', startsAt: '10:30', endsAt: '12:30' },
  { label: '2:00 PM - 4:00 PM', startsAt: '14:00', endsAt: '16:00' },
] as const;

const border = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '94A3B8',
} as const;

const cellBorders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
} as const;

function minutes(value: string) {
  const [hours, mins] = value.slice(0, 5).split(':').map(Number);
  return (hours * 60) + mins;
}

function overlapsSlot(
  row: TimetableReportRow,
  slot: (typeof standardSlots)[number],
) {
  return minutes(row.startsAt) < minutes(slot.endsAt)
    && minutes(row.endsAt) > minutes(slot.startsAt);
}

function cohortCodes(row: TimetableReportRow) {
  const codes = row.participantCohorts.map((cohort) => cohort.code);
  return codes.length > 0 ? codes : [row.cohort];
}

function rowsForCell(
  rows: TimetableReportRow[],
  day: string,
  cohortCode: string,
  slot: (typeof standardSlots)[number],
) {
  return rows.filter((row) =>
    row.day.toLowerCase() === day.toLowerCase()
      && cohortCodes(row).includes(cohortCode)
      && overlapsSlot(row, slot),
  );
}

function departmentHeading(departmentName: string) {
  const normalized = departmentName.trim();
  return /department$/i.test(normalized)
    ? normalized
    : `${normalized} Department`;
}

function textCell({
  text,
  width,
  style,
  fill,
}: {
  text: string;
  width: number;
  style: string;
  fill?: string;
}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill
      ? { fill, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    children: [
      new Paragraph({
        style,
        alignment: AlignmentType.CENTER,
        children: [new TextRun(text)],
      }),
    ],
  });
}

export function masterSessionParagraphs(
  rows: TimetableReportRow[],
) {
  if (rows.length === 0) {
    return [new Paragraph({ style: 'MasterEmpty', text: '' })];
  }

  return rows.flatMap((row, index) => {
    const presentation = getMasterSessionPresentation(row);

    return [
      new Paragraph({
        style: 'MasterUnit',
        spacing: { before: index === 0 ? 0 : 120, after: 30, line: 260 },
        children: [new TextRun(presentation.unitName)],
      }),
      new Paragraph({
        style: 'MasterTrainer',
        children: [
          new TextRun({ bold: true, text: 'Trainer: ' }),
          new TextRun(presentation.trainer),
        ],
      }),
      new Paragraph({
        style: 'MasterVenue',
        children: [
          new TextRun({ bold: true, text: 'Venue: ' }),
          new TextRun(presentation.venue),
        ],
      }),
    ];
  });
}

function sessionCell(
  rows: TimetableReportRow[],
  width: number,
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: masterSessionParagraphs(rows),
  });
}

function createMasterTable(data: TimetableReportsData) {
  const cohortCodesForReport = Array.from(new Set(
    data.rows.flatMap(cohortCodes),
  )).sort((left, right) => left.localeCompare(right));

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      textCell({ text: 'DAY', width: COLUMN_WIDTHS[0], style: 'MasterTableHeader', fill: '8A001C' }),
      textCell({ text: 'COHORT', width: COLUMN_WIDTHS[1], style: 'MasterTableHeader', fill: '8A001C' }),
      ...standardSlots.map((slot, index) => textCell({
        text: slot.label,
        width: COLUMN_WIDTHS[index + 2],
        style: 'MasterTableHeader',
        fill: '8A001C',
      })),
    ],
  });

  const timetableRows = WEEKDAYS.flatMap((day) =>
    cohortCodesForReport.map((cohortCode) => new TableRow({
      cantSplit: true,
      children: [
        textCell({
          text: day.toUpperCase(),
          width: COLUMN_WIDTHS[0],
          style: 'MasterDay',
          fill: 'DCEAF3',
        }),
        textCell({
          text: cohortCode,
          width: COLUMN_WIDTHS[1],
          style: 'MasterCohort',
          fill: 'EAF2F8',
        }),
        ...standardSlots.map((slot, index) => sessionCell(
          rowsForCell(data.rows, day, cohortCode, slot),
          COLUMN_WIDTHS[index + 2],
        )),
      ],
    })),
  );

  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    indent: { size: TABLE_INDENT_DXA, type: WidthType.DXA },
    columnWidths: [...COLUMN_WIDTHS],
    layout: TableLayoutType.FIXED,
    margins: CELL_MARGINS,
    rows: [headerRow, ...timetableRows],
  });
}

export async function buildMasterTimetableDocx({
  data,
  departmentName,
  periodLabel,
  generatedOn,
}: {
  data: TimetableReportsData;
  departmentName: string;
  periodLabel: string;
  generatedOn: string;
}) {
  // compact_reference_guide preset with one named timetable_landscape
  // override: Letter landscape, 0.5-inch margins and a 14,280-DXA table.
  const document = new Document({
    creator: departmentName,
    title: `${departmentHeading(departmentName)} Master Timetable - ${periodLabel}`,
    description: 'Editable department master timetable',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '111827' },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: 'MasterInstitution',
          name: 'Master Institution',
          basedOn: 'Normal',
          next: 'MasterDepartment',
          quickFormat: true,
          run: { font: 'Calibri', size: 30, bold: true, color: '17365D' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60, line: 300 } },
        },
        {
          id: 'MasterDepartment',
          name: 'Master Department',
          basedOn: 'Normal',
          next: 'MasterTitle',
          quickFormat: true,
          run: { font: 'Calibri', size: 26, bold: true, color: '8A001C', allCaps: true },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40, line: 300 } },
        },
        {
          id: 'MasterTitle',
          name: 'Master Timetable Title',
          basedOn: 'Normal',
          next: 'MasterSubtitle',
          quickFormat: true,
          run: { font: 'Calibri', size: 28, bold: true, color: '111827' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40, line: 300 } },
        },
        {
          id: 'MasterSubtitle',
          name: 'Master Timetable Subtitle',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Calibri', size: 18, color: '475569' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 180, line: 300 } },
        },
        {
          id: 'MasterTableHeader',
          name: 'Master Table Header',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 18, bold: true, color: 'FFFFFF' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 260 } },
        },
        {
          id: 'MasterDay',
          name: 'Master Day',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 17, bold: true, color: '17365D' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 260 } },
        },
        {
          id: 'MasterCohort',
          name: 'Master Cohort',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 17, bold: true, color: '17365D' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 260 } },
        },
        {
          id: 'MasterUnit',
          name: 'Master Unit',
          basedOn: 'Normal',
          next: 'MasterTrainer',
          run: { font: 'Calibri', size: 20, bold: true, color: '0B2545' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 30, line: 260 } },
        },
        {
          id: 'MasterTrainer',
          name: 'Master Trainer',
          basedOn: 'Normal',
          next: 'MasterVenue',
          run: { font: 'Calibri', size: 17, color: '334155' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20, line: 240 } },
        },
        {
          id: 'MasterVenue',
          name: 'Master Venue',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 16, italics: true, color: '64748B' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 240 } },
        },
        {
          id: 'MasterEmpty',
          name: 'Master Empty Cell',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 16, color: '94A3B8' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 240 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_DXA,
              height: PAGE_HEIGHT_DXA,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: PAGE_MARGIN_DXA,
              right: PAGE_MARGIN_DXA,
              bottom: PAGE_MARGIN_DXA,
              left: PAGE_MARGIN_DXA,
              header: 360,
              footer: 360,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: `${departmentHeading(departmentName)} | ${periodLabel}`,
                    font: 'Calibri',
                    size: 16,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    children: [
                      `Editable master timetable | Generated ${generatedOn} | Page `,
                      PageNumber.CURRENT,
                    ],
                    font: 'Calibri',
                    size: 15,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ style: 'MasterInstitution', text: INSTITUTION_NAME }),
          new Paragraph({ style: 'MasterDepartment', text: departmentHeading(departmentName) }),
          new Paragraph({ style: 'MasterTitle', text: 'DEPARTMENT MASTER TIMETABLE' }),
          new Paragraph({ style: 'MasterSubtitle', text: `${periodLabel} | Current timetable` }),
          createMasterTable(data),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}

function rowsForPersonalCell(
  rows: TimetableReportRow[],
  day: string,
  slot: (typeof standardSlots)[number],
) {
  return rows.filter((row) =>
    row.day.toLowerCase() === day.toLowerCase()
      && overlapsSlot(row, slot),
  );
}

export function personalSessionParagraphs(
  rows: TimetableReportRow[],
) {
  if (rows.length === 0) {
    return [new Paragraph({ style: 'PersonalEmpty', text: '' })];
  }

  return rows.flatMap((row, index) => {
    const department = row.departmentCode
      ?? row.departmentName
      ?? 'Department';
    const cohort = cohortCodes(row).join(' + ');
    const venue = row.roomCode
      ? row.roomName || row.roomCode
      : 'Unallocated';

    return [
      new Paragraph({
        style: 'PersonalUnit',
        spacing: { before: index === 0 ? 0 : 120, after: 30, line: 250 },
        children: [new TextRun(`${row.unitCode} - ${row.unitName}`)],
      }),
      new Paragraph({
        style: 'PersonalDetail',
        children: [
          new TextRun({ bold: true, text: 'Cohort: ' }),
          new TextRun(cohort),
        ],
      }),
      new Paragraph({
        style: 'PersonalDepartment',
        children: [new TextRun(department)],
      }),
      new Paragraph({
        style: 'PersonalVenue',
        children: [
          new TextRun({ bold: true, text: 'Venue: ' }),
          new TextRun(venue),
        ],
      }),
    ];
  });
}

function createPersonalTable(group: TimetableReportGroup) {
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      textCell({
        text: 'DAY',
        width: PERSONAL_COLUMN_WIDTHS[0],
        style: 'PersonalTableHeader',
        fill: '17365D',
      }),
      ...standardSlots.map((slot, index) => textCell({
        text: slot.label,
        width: PERSONAL_COLUMN_WIDTHS[index + 1],
        style: 'PersonalTableHeader',
        fill: '17365D',
      })),
    ],
  });

  const rows = WEEKDAYS.map((day) => new TableRow({
    cantSplit: true,
    children: [
      textCell({
        text: day.toUpperCase(),
        width: PERSONAL_COLUMN_WIDTHS[0],
        style: 'PersonalDay',
        fill: 'EAF2F8',
      }),
      ...standardSlots.map((slot, index) => new TableCell({
        width: {
          size: PERSONAL_COLUMN_WIDTHS[index + 1],
          type: WidthType.DXA,
        },
        margins: CELL_MARGINS,
        borders: cellBorders,
        verticalAlign: VerticalAlign.CENTER,
        children: personalSessionParagraphs(
          rowsForPersonalCell(group.rows, day, slot),
        ),
      })),
    ],
  }));

  return new Table({
    width: { size: PERSONAL_TABLE_WIDTH_DXA, type: WidthType.DXA },
    indent: { size: TABLE_INDENT_DXA, type: WidthType.DXA },
    columnWidths: [...PERSONAL_COLUMN_WIDTHS],
    layout: TableLayoutType.FIXED,
    margins: CELL_MARGINS,
    rows: [header, ...rows],
  });
}

function personalDepartmentLabel(group: TimetableReportGroup) {
  const labels = Array.from(new Set(
    group.rows
      .map((row) => row.departmentName ?? row.departmentCode)
      .filter((value): value is string => Boolean(value)),
  ));

  return labels.length > 0
    ? labels.join(' + ')
    : 'Assigned department';
}

export async function buildPersonalTimetablesDocx({
  data,
  periodLabel,
  generatedOn,
}: {
  data: TimetableReportsData;
  periodLabel: string;
  generatedOn: string;
}) {
  const groups = data.byTrainer.length > 0
    ? data.byTrainer
    : [{
        key: 'empty',
        label: 'No assigned trainers',
        sessionCount: 0,
        contactHours: 0,
        rows: [],
      }];

  // compact_reference_guide with a named personal_timetable_portrait
  // override: Letter portrait, 0.6-inch margins and a 10,392-DXA grid.
  const document = new Document({
    creator: INSTITUTION_NAME,
    title: `Personal Trainer Timetables - ${periodLabel}`,
    description: 'Editable institution-wide personal trainer timetables',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '111827' },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: 'PersonalInstitution',
          name: 'Personal Institution',
          basedOn: 'Normal',
          next: 'PersonalTitle',
          quickFormat: true,
          run: { font: 'Calibri', size: 28, bold: true, color: '17365D' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 50, line: 300 } },
        },
        {
          id: 'PersonalTitle',
          name: 'Personal Timetable Title',
          basedOn: 'Normal',
          next: 'PersonalTrainer',
          quickFormat: true,
          run: { font: 'Calibri', size: 26, bold: true, color: '8A001C' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40, line: 300 } },
        },
        {
          id: 'PersonalTrainer',
          name: 'Personal Trainer Name',
          basedOn: 'Normal',
          next: 'PersonalMeta',
          quickFormat: true,
          run: { font: 'Calibri', size: 24, bold: true, color: '111827' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 35, line: 300 } },
        },
        {
          id: 'PersonalMeta',
          name: 'Personal Timetable Metadata',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 17, color: '475569' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 25, line: 260 } },
        },
        {
          id: 'PersonalTableHeader',
          name: 'Personal Table Header',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 18, bold: true, color: 'FFFFFF' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 250 } },
        },
        {
          id: 'PersonalDay',
          name: 'Personal Day',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 17, bold: true, color: '17365D' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 250 } },
        },
        {
          id: 'PersonalUnit',
          name: 'Personal Unit',
          basedOn: 'Normal',
          next: 'PersonalDetail',
          run: { font: 'Calibri', size: 19, bold: true, color: '0B2545' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 30, line: 250 } },
        },
        {
          id: 'PersonalDetail',
          name: 'Personal Cohort Detail',
          basedOn: 'Normal',
          next: 'PersonalDepartment',
          run: { font: 'Calibri', size: 16, color: '334155' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20, line: 230 } },
        },
        {
          id: 'PersonalDepartment',
          name: 'Personal Department',
          basedOn: 'Normal',
          next: 'PersonalVenue',
          run: { font: 'Calibri', size: 15, bold: true, color: '8A001C' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20, line: 230 } },
        },
        {
          id: 'PersonalVenue',
          name: 'Personal Venue',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 15, italics: true, color: '64748B' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 230 } },
        },
        {
          id: 'PersonalEmpty',
          name: 'Personal Empty Cell',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 15, color: '94A3B8' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 230 } },
        },
      ],
    },
    sections: groups.map((group, index) => ({
      properties: {
        ...(index === 0 ? {} : { type: SectionType.NEXT_PAGE }),
        page: {
          size: {
            width: PERSONAL_PAGE_WIDTH_DXA,
            height: PERSONAL_PAGE_HEIGHT_DXA,
            orientation: PageOrientation.PORTRAIT,
          },
          margin: {
            top: PERSONAL_PAGE_MARGIN_DXA,
            right: PERSONAL_PAGE_MARGIN_DXA,
            bottom: PERSONAL_PAGE_MARGIN_DXA,
            left: PERSONAL_PAGE_MARGIN_DXA,
            header: 360,
            footer: 360,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: `Personal timetable | ${periodLabel}`,
                  font: 'Calibri',
                  size: 15,
                  color: '64748B',
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  children: [
                    `Editable personal timetable | Generated ${generatedOn} | Page `,
                    PageNumber.CURRENT,
                  ],
                  font: 'Calibri',
                  size: 15,
                  color: '64748B',
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({ style: 'PersonalInstitution', text: INSTITUTION_NAME }),
        new Paragraph({ style: 'PersonalTitle', text: 'PERSONAL TRAINER TIMETABLE' }),
        new Paragraph({ style: 'PersonalTrainer', text: group.label.toUpperCase() }),
        new Paragraph({
          style: 'PersonalMeta',
          text: `${periodLabel} | ${group.contactHours} scheduled hours | Target ${group.targetHours ?? 0} hours`,
        }),
        new Paragraph({
          style: 'PersonalMeta',
          text: `Teaching departments: ${personalDepartmentLabel(group)}`,
        }),
        createPersonalTable(group),
      ],
    })),
  });

  return Packer.toBuffer(document);
}
