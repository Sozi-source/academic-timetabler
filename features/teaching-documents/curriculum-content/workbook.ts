import ExcelJS from 'exceljs';
import {
  COURSE_OUTLINE_CONTENT_HEADERS,
  COURSE_OUTLINE_UNIT_HEADERS,
  SCHEME_CONTENT_HEADERS,
  SCHEME_UNIT_HEADERS,
} from '../curriculum-import-v5/schema';

const NAVY = 'FF17365D';
const WHITE = 'FFFFFFFF';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: WHITE },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NAVY },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
  });
}

function addInstructions(
  workbook: ExcelJS.Workbook,
  label: string,
) {
  const sheet = workbook.addWorksheet(
    'Instructions',
  );

  sheet.columns = [
    { width: 20 },
    { width: 90 },
  ];

  sheet.addRow([
    `${label} Curriculum Import`,
    '',
  ]);

  sheet.mergeCells('A1:B1');

  sheet.getCell('A1').font = {
    bold: true,
    size: 16,
    color: { argb: WHITE },
  };

  sheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };

  sheet.addRow([]);
  sheet.addRow(['Step', 'What to do']);
  styleHeader(sheet.getRow(3));

  [
    [
      '1',
      'Add each unit once in Units. Unit code is preferred but unit name can be mapped during review.',
    ],
    [
      '2',
      'Add curriculum topics in Content. Sequence is the curriculum order; it does not have to equal academic week.',
    ],
    [
      '3',
      'CAT, examination, revision and holidays belong to the academic calendar, not curriculum content.',
    ],
    [
      '4',
      'Upload the workbook. Academic Planner will stage it and show mapping/review issues before import.',
    ],
    [
      '5',
      'Do not add institutional headers, logos, trainer details or approval sections here. The system renders those later.',
    ],
  ].forEach((row) => sheet.addRow(row));
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: readonly string[],
  widths: number[],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ],
  });

  sheet.addRow([...headers]);
  styleHeader(sheet.getRow(1));

  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  return sheet;
}

export async function generateCourseOutlineImportTemplate() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator =
    'Imperial College Academic Planner';

  addInstructions(workbook, 'Course Outline');

  addDataSheet(
    workbook,
    'Units',
    COURSE_OUTLINE_UNIT_HEADERS,
    [
      18,
      42,
      34,
      18,
      80,
      90,
      60,
      55,
      90,
    ],
  );

  addDataSheet(
    workbook,
    'Content',
    COURSE_OUTLINE_CONTENT_HEADERS,
    [18, 12, 50, 90],
  );

  return workbook.xlsx.writeBuffer();
}

export async function generateSchemeOfWorkImportTemplate() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator =
    'Imperial College Academic Planner';

  addInstructions(workbook, 'Scheme of Work');

  addDataSheet(
    workbook,
    'Units',
    SCHEME_UNIT_HEADERS,
    [18, 42, 34, 18],
  );

  addDataSheet(
    workbook,
    'Content',
    SCHEME_CONTENT_HEADERS,
    [
      18,
      12,
      50,
      80,
      75,
      65,
      60,
      60,
    ],
  );

  return workbook.xlsx.writeBuffer();
}
