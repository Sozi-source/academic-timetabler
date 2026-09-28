import ExcelJS from 'exceljs';

import type {
  ImportColumnDefinition,
  ImportTemplateDefinition,
} from './types';


export type ImportTemplateSeedRow =
  Record<
    string,
    string | number | boolean | Date | null
  >;

export interface GenerateImportTemplateOptions {
  rows?: readonly ImportTemplateSeedRow[];
  includeExampleRow?: boolean;
}
const HEADER_FILL = 'FF2F706B';
const OPTIONAL_HEADER_FILL = 'FF667085';

const OPTIONAL_FILL = 'FFF5F7F8';
const BORDER_COLOR = 'FFD5E0DE';
const WARNING_FILL = 'FFFFF8E7';

function getExcelColumnName(
  columnNumber: number,
) {
  let result = '';
  let value = columnNumber;

  while (value > 0) {
    const remainder = (value - 1) % 26;

    result =
      String.fromCharCode(65 + remainder) +
      result;

    value = Math.floor(
      (value - 1) / 26,
    );
  }

  return result;
}

function escapeFormulaValue(
  value: string,
) {
  return value.replace(/"/g, '""');
}

function addCellValidation(
  worksheet: ExcelJS.Worksheet,
  column: ImportColumnDefinition,
  columnNumber: number,
  maximumRows: number,
) {
  const columnLetter =
    getExcelColumnName(columnNumber);

  for (
    let rowNumber = 2;
    rowNumber <= maximumRows + 1;
    rowNumber += 1
  ) {
    const cell =
      worksheet.getCell(
        `${columnLetter}${rowNumber}`,
      );

    if (
      column.acceptedValues &&
      column.acceptedValues.length > 0
    ) {
      const values =
        column.acceptedValues.join(',');

      cell.dataValidation = {
        type: 'list',
        allowBlank: !column.required,
        formulae: [
          `"${escapeFormulaValue(values)}"`,
        ],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid value',
        error:
          'Select one of the accepted values from the dropdown.',
        showInputMessage: true,
        promptTitle: column.header,
        prompt:
          column.description ??
          'Select an accepted value.',
      };

      continue;
    }

    if (
      column.cellType === 'integer'
    ) {
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: !column.required,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid number',
        error:
          'Enter a valid whole number.',
      };

      continue;
    }

    if (
      column.cellType === 'number'
    ) {
      cell.dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: !column.required,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid number',
        error:
          'Enter a valid numeric value.',
      };

      continue;
    }

    if (column.cellType === 'date') {
      cell.dataValidation = {
        type: 'date',
        operator: 'between',
        allowBlank: !column.required,
        formulae: [
          new Date('2000-01-01'),
          new Date('2100-12-31'),
        ],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid date',
        error:
          'Enter a valid date.',
      };
    }
  }
}

function createInstructionsSheet(
  workbook: ExcelJS.Workbook,
  definition: ImportTemplateDefinition,
) {
  const worksheet =
    workbook.addWorksheet(
      definition.instructionsWorksheetName,
      {
        views: [
          {
            showGridLines: false,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      width: 24,
    },
    {
      width: 62,
    },
    {
      width: 30,
    },
  ];

  worksheet.mergeCells('A1:C1');

  const title = worksheet.getCell('A1');

  title.value =
    `${definition.displayName} Import Template`;

  title.font = {
    bold: true,
    size: 18,
    color: {
      argb: 'FFFFFFFF',
    },
  };

  title.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: HEADER_FILL,
    },
  };

  title.alignment = {
    vertical: 'middle',
    horizontal: 'left',
  };

  worksheet.getRow(1).height = 34;

  worksheet.mergeCells('A3:C3');

  worksheet.getCell('A3').value =
    'How to use this template';

  worksheet.getCell('A3').font = {
    bold: true,
    size: 13,
  };

  const defaultInstructions = [
    'Enter records only in the Data worksheet.',
    'Keep every fixed column heading in its original position. Do not rename, move or delete columns.',
    'Do not delete the hidden metadata worksheet.',
    'Teal headings are required. Grey headings are optional and their cells may be left blank.',
    'Blank optional cells use the default shown in the column guide, where a default is provided.',
    'Use the provided dropdown values exactly as shown.',
    'Remove the example row before uploading, or replace it with real data.',
    'Save the completed workbook in .xlsx format.',
    `The template supports up to ${definition.maximumRows ?? 10000} data rows.`,
  ] as const;

  const instructions =
    definition.instructions ??
    defaultInstructions;

  instructions.forEach(
    (instruction, index) => {
      worksheet.mergeCells(
        `A${index + 4}:C${index + 4}`,
      );

      worksheet.getCell(
        `A${index + 4}`,
      ).value =
        `${index + 1}. ${instruction}`;

      worksheet.getCell(
        `A${index + 4}`,
      ).alignment = {
        wrapText: true,
        vertical: 'top',
      };
    },
  );

  const headingRow =
    instructions.length + 6;

  worksheet.getRow(headingRow).values = [
    'Column',
    'Description',
    'Accepted values / example',
  ];

  worksheet.getRow(headingRow).eachCell(
    (cell) => {
      cell.font = {
        bold: true,
        color: {
          argb: 'FFFFFFFF',
        },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: HEADER_FILL,
        },
      };

      cell.alignment = {
        wrapText: true,
        vertical: 'middle',
      };
    },
  );

  definition.columns.forEach(
    (column, index) => {
      const rowNumber =
        headingRow + index + 1;

      const row =
        worksheet.getRow(rowNumber);

      row.values = [
        `${column.header}${
          column.required
            ? ' * Required'
            : ' (Optional)'
        }`,
        column.description ?? '',
        column.acceptedValues?.join(
          ', ',
        ) ?? String(
          column.defaultValue ??
            column.example ??
            '',
        ),
      ];

      row.eachCell((cell) => {
        cell.alignment = {
          wrapText: true,
          vertical: 'top',
        };

        cell.border = {
          bottom: {
            style: 'thin',
            color: {
              argb: BORDER_COLOR,
            },
          },
        };
      });
    },
  );

  worksheet.mergeCells(
    `A${headingRow + definition.columns.length + 2}:C${
      headingRow +
      definition.columns.length +
      2
    }`,
  );

  const warningCell =
    worksheet.getCell(
      `A${
        headingRow +
        definition.columns.length +
        2
      }`,
    );

  warningCell.value =
    'Important: changing the headings, worksheet names or metadata may cause the upload to be rejected.';

  warningCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: WARNING_FILL,
    },
  };

  warningCell.font = {
    bold: true,
  };

  warningCell.alignment = {
    wrapText: true,
    vertical: 'middle',
  };

  worksheet.getRow(
    headingRow +
      definition.columns.length +
      2,
  ).height = 34;

  return worksheet;
}

function createDataSheet(
  workbook: ExcelJS.Workbook,
  definition: ImportTemplateDefinition,
  options: GenerateImportTemplateOptions,
) {
  const worksheet =
    workbook.addWorksheet(
      definition.dataWorksheetName,
      {
        views: [
          {
            state: 'frozen',
            ySplit: 1,
            showGridLines: true,
          },
        ],
      },
    );

  worksheet.columns =
    definition.columns.map(
      (column) => ({
        header: column.header,
        key: column.key,
        width: column.width ?? 22,
        style: {
          numFmt:
            column.numberFormat ??
            'General',
        },
      }),
    );

  const headerRow = worksheet.getRow(1);

  headerRow.height = 32;

  definition.columns.forEach(
    (column, index) => {
      const cell =
        headerRow.getCell(index + 1);

      cell.value = column.header;

      cell.font = {
        bold: true,
        color: {
          argb: 'FFFFFFFF',
        },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: column.required
            ? HEADER_FILL
            : OPTIONAL_HEADER_FILL,
        },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
      };

      cell.border = {
        bottom: {
          style: 'medium',
          color: {
            argb: HEADER_FILL,
          },
        },
      };
    },
  );

  const suppliedRows =
    options.rows ?? [];

  const includeExampleRow =
    options.includeExampleRow ??
    suppliedRows.length === 0;

  if (includeExampleRow) {
    const exampleRow =
      worksheet.addRow(
        Object.fromEntries(
          definition.columns.map(
            (column) => [
              column.key,
              column.example ?? null,
            ],
          ),
        ),
      );

    exampleRow.height = 28;

    definition.columns.forEach(
      (column, index) => {
        const cell =
          exampleRow.getCell(index + 1);

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: OPTIONAL_FILL,
          },
        };

        cell.font = {
          italic: true,
          color: {
            argb: 'FF667085',
          },
        };

        cell.alignment = {
          vertical: 'middle',
          wrapText: true,
        };
      },
    );
  }

  for (const suppliedRow of suppliedRows) {
    const row =
      worksheet.addRow(
        Object.fromEntries(
          definition.columns.map(
            (column) => [
              column.key,
              suppliedRow[column.key] ??
                null,
            ],
          ),
        ),
      );

    row.height = 24;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
      };
    });
  }

  const maximumRows =
    definition.maximumRows ?? 10000;

  definition.columns.forEach(
    (column, index) => {
      addCellValidation(
        worksheet,
        column,
        index + 1,
        maximumRows,
      );
    },
  );

  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        definition.columns.length,
    },
  };

  worksheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: false,
    formatRows: false,
    insertRows: true,
    deleteRows: true,
    sort: true,
    autoFilter: true,
  });

  for (
    let rowNumber = 2;
    rowNumber <= maximumRows + 1;
    rowNumber += 1
  ) {
    for (
      let columnNumber = 1;
      columnNumber <=
      definition.columns.length;
      columnNumber += 1
    ) {
      worksheet.getCell(
        rowNumber,
        columnNumber,
      ).protection = {
        locked: false,
      };
    }
  }

  headerRow.eachCell((cell) => {
    cell.protection = {
      locked: true,
    };
  });

  return worksheet;
}

function createMetadataSheet(
  workbook: ExcelJS.Workbook,
  definition: ImportTemplateDefinition,
) {
  const worksheet =
    workbook.addWorksheet(
      definition.metadataWorksheetName,
    );

  worksheet.addRows([
    [
      'template_key',
      definition.key,
    ],
    [
      'template_version',
      definition.version,
    ],
    [
      'entity_type',
      definition.entityType,
    ],
    [
      'generated_at',
      new Date().toISOString(),
    ],
  ]);

  worksheet.state = 'veryHidden';

  return worksheet;
}

export async function generateImportTemplate(
  definition: ImportTemplateDefinition,
  options: GenerateImportTemplateOptions = {},
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Institutional Timetabler';
  workbook.company =
    'Institutional Academic Operations';
  workbook.subject =
    `${definition.displayName} import template`;
  workbook.title =
    `${definition.displayName} Import Template`;
  workbook.created = new Date();

  createInstructionsSheet(
    workbook,
    definition,
  );

  createDataSheet(
    workbook,
    definition,
    options,
  );

  createMetadataSheet(
    workbook,
    definition,
  );

  const generated =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(generated);
}
