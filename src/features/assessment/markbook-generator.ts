import ExcelJS from 'exceljs';

export const assessmentMarkbookTemplateVersion =
  '1.0';

export interface AssessmentMarkbookStudent {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus:
    | 'expected'
    | 'absent';
  marks?: {
    assignment: number | null;
    presentation: number | null;
    rat: number | null;
    cat: number | null;
    exam: number | null;
  };
}

export interface AssessmentMarkbookCohort {
  assessmentId: string;
  cohortId: string | null;
  cohortName: string;
  students: AssessmentMarkbookStudent[];
}

export interface AssessmentMarkbookBundle {
  generationId: string;
  rootAssessmentId: string;
  assessmentType:
    | 'cat'
    | 'exam';
  academicPeriod: {
    id: string;
    code: string | null;
    name: string;
  };
  unit: {
    id: string;
    code: string | null;
    name: string;
  };
  cohorts: AssessmentMarkbookCohort[];
  generatedAt: Date;
}

const navy =
  'FF102B54';

const lightBorder =
  'FFD9E1EA';

const pale =
  'FFF4F7FA';

function applyThinBorder(
  cell: ExcelJS.Cell,
) {
  cell.border = {
    top: {
      style: 'thin',
      color: {
        argb: lightBorder,
      },
    },
    left: {
      style: 'thin',
      color: {
        argb: lightBorder,
      },
    },
    bottom: {
      style: 'thin',
      color: {
        argb: lightBorder,
      },
    },
    right: {
      style: 'thin',
      color: {
        argb: lightBorder,
      },
    },
  };
}

function safeSheetName(
  value: string,
  fallback: string,
): string {
  const cleaned =
    value
      .replace(
        /[\\/?*\[\]:]/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();

  return (
    cleaned ||
    fallback
  ).slice(0, 31);
}

function uniqueSheetName(
  workbook: ExcelJS.Workbook,
  desired: string,
): string {
  const existing =
    new Set(
      workbook.worksheets.map(
        (sheet) =>
          sheet.name.toLowerCase(),
      ),
    );

  if (
    !existing.has(
      desired.toLowerCase(),
    )
  ) {
    return desired;
  }

  for (
    let index = 2;
    index < 1000;
    index += 1
  ) {
    const suffix =
      ` ${index}`;

    const candidate =
      desired
        .slice(
          0,
          31 -
            suffix.length,
        ) +
      suffix;

    if (
      !existing.has(
        candidate.toLowerCase(),
      )
    ) {
      return candidate;
    }
  }

  throw new Error(
    'Could not generate a unique cohort worksheet name.',
  );
}

function assessmentLabel(
  type:
    | 'cat'
    | 'exam',
): string {
  return type === 'cat'
    ? 'CAT MARKSHEET'
    : 'EXAM MARKSHEET';
}

function createCohortSheet(
  workbook: ExcelJS.Workbook,
  bundle: AssessmentMarkbookBundle,
  cohort: AssessmentMarkbookCohort,
) {
  const desired =
    safeSheetName(
      cohort.cohortName,
      'Cohort',
    );

  const sheet =
    workbook.addWorksheet(
      uniqueSheetName(
        workbook,
        desired,
      ),
      {
        views: [
          {
            state: 'frozen',
            ySplit: 7,
            showGridLines: false,
          },
        ],
        pageSetup: {
          orientation:
            'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.3,
            right: 0.3,
            top: 0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2,
          },
        },
      },
    );

  sheet.properties.defaultRowHeight =
    18;

  sheet.mergeCells(
    'A1:F1',
  );

  const title =
    sheet.getCell('A1');

  title.value =
    'ACADEMIC PLANNER';

  title.font = {
    bold: true,
    size: 14,
    color: {
      argb: navy,
    },
  };

  title.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  sheet.mergeCells(
    'A2:F2',
  );

  const assessmentTitle =
    sheet.getCell('A2');

  assessmentTitle.value =
    assessmentLabel(
      bundle.assessmentType,
    );

  assessmentTitle.font = {
    bold: true,
    size: 12,
    color: {
      argb: 'FF000000',
    },
  };

  assessmentTitle.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  sheet.getCell('A4').value =
    'Unit';

  sheet.mergeCells(
    'B4:C4',
  );

  sheet.getCell('B4').value =
    bundle.unit.name;

  sheet.getCell('D4').value =
    'Cohort';

  sheet.mergeCells(
    'E4:F4',
  );

  sheet.getCell('E4').value =
    cohort.cohortName;

  sheet.getCell('A5').value =
    'Academic Period';

  sheet.mergeCells(
    'B5:C5',
  );

  sheet.getCell('B5').value =
    bundle.academicPeriod.name;

  sheet.getCell('D5').value =
    'Generated';

  sheet.mergeCells(
    'E5:F5',
  );

  sheet.getCell('E5').value =
    bundle.generatedAt;

  sheet.getCell('E5').numFmt =
    'dd mmm yyyy HH:mm';

  for (
    const cellAddress of [
      'A4',
      'D4',
      'A5',
      'D5',
    ]
  ) {
    const cell =
      sheet.getCell(
        cellAddress,
      );

    cell.font = {
      bold: true,
      size: 9,
      color: {
        argb: 'FF4B5563',
      },
    };
  }

  for (
    const cellAddress of [
      'B4',
      'E4',
      'B5',
      'E5',
    ]
  ) {
    sheet.getCell(
      cellAddress,
    ).font = {
      size: 9,
      color: {
        argb: 'FF111827',
      },
    };
  }

  const headerRow =
    sheet.getRow(7);

  headerRow.values = [
    'No.',
    'Admission Number',
    'Student Name',
    'Attendance',
    'Mark',
    'Remarks',
  ];

  headerRow.height =
    24;

  headerRow.eachCell(
    (cell) => {
      cell.font = {
        bold: true,
        size: 9,
        color: {
          argb: 'FFFFFFFF',
        },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: navy,
        },
      };

      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };

      applyThinBorder(
        cell,
      );
    },
  );

  const students =
    [...cohort.students].sort(
      (
        first,
        second,
      ) =>
        first.admissionNumber.localeCompare(
          second.admissionNumber,
        ) ||
        first.fullName.localeCompare(
          second.fullName,
        ),
    );

  students.forEach(
    (
      student,
      index,
    ) => {
      const rowNumber =
        8 + index;

      const row =
        sheet.getRow(
          rowNumber,
        );

      row.values = [
        index + 1,
        student.admissionNumber,
        student.fullName,
        student.attendanceStatus ===
        'absent'
          ? 'Absent'
          : 'Expected',
        student.attendanceStatus ===
        'absent'
          ? 'AB'
          : '',
        '',
      ];

      row.height = 20;

      row.eachCell(
        (cell, colNumber) => {
          cell.font = {
            size: 9,
            color: {
              argb: 'FF111827',
            },
          };

          cell.alignment = {
            vertical: 'middle',
            wrapText: colNumber !== 2,
          };

          applyThinBorder(
            cell,
          );
        },
      );

      sheet.getCell(
        rowNumber,
        1,
      ).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      sheet.getCell(
        rowNumber,
        4,
      ).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      sheet.getCell(
        rowNumber,
        5,
      ).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      if (
        student.attendanceStatus ===
        'absent'
      ) {
        for (
          const columnNumber of [
            4,
            5,
          ]
        ) {
          sheet.getCell(
            rowNumber,
            columnNumber,
          ).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: pale,
            },
          };
        }

        sheet.getCell(
          rowNumber,
          5,
        ).font = {
          bold: true,
          size: 9,
          color: {
            argb: 'FF7F1D1D',
          },
        };
      } else {
        sheet.getCell(
          rowNumber,
          5,
        ).protection = {
          locked: false,
        };

        sheet.getCell(
          rowNumber,
          6,
        ).protection = {
          locked: false,
        };
      }
    },
  );

  sheet.columns = [
    {
      key: 'number',
      width: 7,
    },
    {
      key: 'admission',
      width: 28,
    },
    {
      key: 'name',
      width: 34,
    },
    {
      key: 'attendance',
      width: 14,
    },
    {
      key: 'mark',
      width: 12,
    },
    {
      key: 'remarks',
      width: 24,
    },
  ];

  sheet.autoFilter = {
    from: {
      row: 7,
      column: 1,
    },
    to: {
      row: 7,
      column: 6,
    },
  };

  sheet.headerFooter.oddFooter =
    '&LGenerated by Academic Planner&CPage &P of &N&RDo not rename worksheets';

  return {
    sheet,
    firstStudentRow: 8,
    students,
  };
}

function createOnlineMarksReportSheet(
  workbook: ExcelJS.Workbook,
  bundle: AssessmentMarkbookBundle,
  cohort: AssessmentMarkbookCohort,
) {
  const sheet = workbook.addWorksheet(
    uniqueSheetName(workbook, safeSheetName(cohort.cohortName, 'Cohort')),
    {
      views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 },
      },
    },
  );

  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').value = 'IMPERIAL COLLEGE TRAINER PORTAL';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: navy } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:K2');
  sheet.getCell('A2').value = 'ONLINE MARKS REPORT';
  sheet.getCell('A2').font = { bold: true, size: 12 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.mergeCells('A4:K4');
  sheet.getCell('A4').value = `${bundle.unit.code ?? ''} ${bundle.unit.name} · ${cohort.cohortName}`.trim();
  sheet.getCell('A4').font = { bold: true, size: 10 };
  sheet.getCell('A4').alignment = { horizontal: 'center' };

  sheet.mergeCells('A5:K5');
  sheet.getCell('A5').value = `${bundle.academicPeriod.name} · Generated ${bundle.generatedAt.toLocaleString('en-GB')}`;
  sheet.getCell('A5').font = { size: 9, color: { argb: 'FF4B5563' } };
  sheet.getCell('A5').alignment = { horizontal: 'center' };

  const headerRow = sheet.getRow(7);
  headerRow.values = [
    'No.',
    'Admission Number',
    'Student Name',
    'Attendance',
    'Assignment /5',
    'Presentation /10',
    'RAT /15',
    'CAT /15',
    'Exam /70',
    'RAT/CAT /15',
    'Final /100',
  ];
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyThinBorder(cell);
  });

  const students = [...cohort.students].sort(
    (first, second) =>
      first.admissionNumber.localeCompare(second.admissionNumber) ||
      first.fullName.localeCompare(second.fullName),
  );

  students.forEach((student, index) => {
    const rowNumber = 8 + index;
    const marks = student.marks ?? {
      assignment: null,
      presentation: null,
      rat: null,
      cat: null,
      exam: null,
    };
    const ratCatAverage =
      marks.rat === null || marks.cat === null
        ? null
        : (marks.rat + marks.cat) / 2;
    const final =
      student.attendanceStatus === 'absent' ||
      marks.assignment === null ||
      marks.presentation === null ||
      ratCatAverage === null ||
      marks.exam === null
        ? null
        : marks.assignment + marks.presentation + ratCatAverage + marks.exam;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      student.admissionNumber,
      student.fullName,
      student.attendanceStatus === 'absent' ? 'Absent' : 'Expected',
      marks.assignment,
      marks.presentation,
      marks.rat,
      marks.cat,
      student.attendanceStatus === 'absent' ? 'AB' : marks.exam,
      ratCatAverage,
      student.attendanceStatus === 'absent' ? 'AB' : final,
    ];
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 9, color: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'middle', wrapText: colNumber !== 2 };
      applyThinBorder(cell);
    });
    for (let column = 1; column <= 11; column += 1) {
      if (column !== 2 && column !== 3) {
        sheet.getCell(rowNumber, column).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
      }
    }
    if (student.attendanceStatus === 'absent') {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pale } };
      });
    }
  });

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 28 },
    { width: 12 },
    { width: 13 },
    { width: 15 },
    { width: 10 },
    { width: 10 },
    { width: 11 },
    { width: 13 },
    { width: 12 },
  ];
  sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: 11 } };
  sheet.headerFooter.oddFooter = '&LGenerated from online marks&CPage &P of &N&RTrainer Portal';

  return { sheet, firstStudentRow: 8, students };
}

export async function generateAssessmentMarkbook(
  bundle: AssessmentMarkbookBundle,
): Promise<Buffer> {
  if (
    bundle.cohorts.length === 0
  ) {
    throw new Error(
      'The markbook bundle has no cohorts.',
    );
  }

  const totalStudents =
    bundle.cohorts.reduce(
      (
        total,
        cohort,
      ) =>
        total +
        cohort.students.length,
      0,
    );

  if (totalStudents === 0) {
    throw new Error(
      'The markbook bundle has no students.',
    );
  }

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Academic Planner';

  workbook.company =
    'Academic Planner';

  workbook.subject =
    `${assessmentLabel(
      bundle.assessmentType,
    )} - ${bundle.unit.name}`;

  workbook.title =
    bundle.unit.name;

  workbook.created =
    bundle.generatedAt;

  const rowMap: Array<{
    sheetName: string;
    assessmentId: string;
    cohortId: string | null;
    cohortName: string;
    studentId: string;
    admissionNumber: string;
    workbookRow: number;
    attendanceStatus: string;
  }> = [];

  for (
    const cohort of
      bundle.cohorts
  ) {
    const {
      sheet,
      firstStudentRow,
      students,
    } =
      bundle.assessmentType === 'exam'
        ? createOnlineMarksReportSheet(workbook, bundle, cohort)
        : createCohortSheet(workbook, bundle, cohort);

    students.forEach(
      (
        student,
        index,
      ) => {
        rowMap.push({
          sheetName:
            sheet.name,
          assessmentId:
            cohort.assessmentId,
          cohortId:
            cohort.cohortId,
          cohortName:
            cohort.cohortName,
          studentId:
            student.studentId,
          admissionNumber:
            student.admissionNumber,
          workbookRow:
            firstStudentRow +
            index,
          attendanceStatus:
            student.attendanceStatus,
        });
      },
    );

    await sheet.protect(
      '',
      {
        selectLockedCells:
          true,
        selectUnlockedCells:
          true,
        formatCells:
          false,
        formatColumns:
          false,
        formatRows:
          false,
        insertColumns:
          false,
        insertRows:
          false,
        deleteColumns:
          false,
        deleteRows:
          false,
        sort: true,
        autoFilter: true,
      },
    );
  }

  const metadata =
    workbook.addWorksheet(
      '_metadata',
      {
        state: 'veryHidden',
      },
    );

  metadata.getCell('A1').value =
    'Template Key';

  metadata.getCell('B1').value =
    'assessment-markbook';

  metadata.getCell('A2').value =
    'Template Version';

  metadata.getCell('B2').value =
    assessmentMarkbookTemplateVersion;

  metadata.getCell('A3').value =
    'Generation ID';

  metadata.getCell('B3').value =
    bundle.generationId;

  metadata.getCell('A4').value =
    'Root Assessment ID';

  metadata.getCell('B4').value =
    bundle.rootAssessmentId;

  metadata.getCell('A5').value =
    'Assessment Type';

  metadata.getCell('B5').value =
    bundle.assessmentType;

  metadata.getCell('A6').value =
    'Academic Period ID';

  metadata.getCell('B6').value =
    bundle.academicPeriod.id;

  metadata.getCell('A7').value =
    'Unit ID';

  metadata.getCell('B7').value =
    bundle.unit.id;

  metadata.getCell('A8').value =
    'Unit Name';

  metadata.getCell('B8').value =
    bundle.unit.name;

  metadata.getCell('A9').value =
    'Generated At';

  metadata.getCell('B9').value =
    bundle.generatedAt.toISOString();

  const metadataHeaderRow =
    metadata.getRow(12);

  metadataHeaderRow.values = [
    'Sheet',
    'Assessment ID',
    'Cohort ID',
    'Cohort',
    'Student ID',
    'Admission Number',
    'Workbook Row',
    'Attendance Status',
  ];

  rowMap.forEach(
    (
      entry,
      index,
    ) => {
      metadata.getRow(
        13 + index,
      ).values = [
        entry.sheetName,
        entry.assessmentId,
        entry.cohortId,
        entry.cohortName,
        entry.studentId,
        entry.admissionNumber,
        entry.workbookRow,
        entry.attendanceStatus,
      ];
    },
  );

  metadata.columns = [
    {
      width: 28,
    },
    {
      width: 38,
    },
    {
      width: 38,
    },
    {
      width: 28,
    },
    {
      width: 38,
    },
    {
      width: 20,
    },
    {
      width: 14,
    },
    {
      width: 18,
    },
  ];

  await metadata.protect(
    '',
    {
      selectLockedCells:
        false,
      selectUnlockedCells:
        false,
    },
  );

  const output =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(
    output,
  );
}
