import ExcelJS from 'exceljs';
import type {
  TrainerAllocationDocumentRowV53,
  TrainerTeachingDocumentType,
} from './types';

const NAVY = 'FF17365D';
const WHITE = 'FFFFFFFF';
const MANIFEST_SHEET = '_Manifest';
const WORKBOOK_VERSION = '5.3';

function safeSheetName(
  unitCode: string,
  index: number,
) {
  const normalized = unitCode
    .replace(/[\[\]:*?/\\]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 25);

  return (
    normalized ||
    `UNIT${String(index + 1).padStart(2, '0')}`
  );
}

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

export async function generateMissingTrainerWorkbookV53(
  documentType: TrainerTeachingDocumentType,
  allocations: TrainerAllocationDocumentRowV53[],
  ownerUserId: string,
) {
  if (!allocations.length) {
    throw new Error(
      documentType === 'course_outline'
        ? 'All Course Outlines are up to date.'
        : 'All Schemes of Work are up to date.',
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Imperial College Academic Planner';

  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [
    { width: 20 },
    { width: 90 },
  ];
  instructions.mergeCells('A1:B1');
  instructions.getCell('A1').value =
    documentType === 'course_outline'
      ? 'Course Outlines — Missing Units'
      : 'Schemes of Work — Missing Units';
  instructions.getCell('A1').font = {
    bold: true,
    size: 16,
    color: { argb: WHITE },
  };
  instructions.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };
  instructions.addRow([]);
  instructions.addRow(['Instruction', 'Action']);
  styleHeader(instructions.getRow(3));

  [
    ['Complete', 'Fill only the unit sheets included in this workbook.'],
    ['Identity', 'Unit code and unit name are supplied by Academic Planner. Do not change them.'],
    ['Upload', 'Upload this workbook back through My Teaching Documents.'],
    ['Missing only', 'Units with an active document are intentionally excluded.'],
  ].forEach((row) => instructions.addRow(row));

  const manifest = workbook.addWorksheet(MANIFEST_SHEET, {
    state: 'veryHidden',
  });
  manifest.addRow([
    'workbook_version',
    'document_type',
    'owner_user_id',
    'allocation_id',
    'unit_id',
    'unit_code',
    'unit_name',
    'sheet_name',
  ]);

  allocations.forEach((allocation, index) => {
    const sheetName = safeSheetName(
      allocation.unitCode,
      index,
    );

    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    sheet.columns = [
      { width: 14 },
      { width: 54 },
      { width: 80 },
      { width: 75 },
      { width: 65 },
      { width: 60 },
      { width: 60 },
    ];

    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value =
      allocation.unitName;
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

    sheet.getCell('A2').value = 'Unit code';
    sheet.getCell('B2').value =
      allocation.unitCode;
    sheet.getCell('A3').value = 'Unit name';
    sheet.getCell('B3').value =
      allocation.unitName;
    sheet.getCell('A2').font = { bold: true };
    sheet.getCell('A3').font = { bold: true };

    const headers =
      documentType === 'course_outline'
        ? [
            'sequence',
            'topic',
            'coverage',
          ]
        : [
            'sequence',
            'topic',
            'coverage',
            'learning_outcomes',
            'activities',
            'assessment',
            'resources',
          ];

    sheet.getRow(5).values = headers;
    styleHeader(sheet.getRow(5));

    // Provide easy-to-fill blank curriculum rows.
    for (let sequence = 1; sequence <= 20; sequence += 1) {
      const row = sheet.getRow(sequence + 5);
      row.getCell(1).value = sequence;
      row.alignment = {
        vertical: 'top',
        wrapText: true,
      };
    }

    manifest.addRow([
      WORKBOOK_VERSION,
      documentType,
      ownerUserId,
      allocation.allocationId,
      allocation.unitId,
      allocation.unitCode,
      allocation.unitName,
      sheetName,
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}
