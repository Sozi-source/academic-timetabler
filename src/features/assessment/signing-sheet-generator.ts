import ExcelJS from 'exceljs';

import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';

import type {
  AssessmentMarkbookBundle,
} from './markbook-generator';

export const assessmentSigningSheetTemplateVersion =
  '1.0';

const navy =
  'FF102B54';

const border =
  'FFD9E1EA';

function applyBorder(
  cell: ExcelJS.Cell,
) {
  cell.border = {
    top: {
      style: 'thin',
      color: {
        argb: border,
      },
    },
    left: {
      style: 'thin',
      color: {
        argb: border,
      },
    },
    bottom: {
      style: 'thin',
      color: {
        argb: border,
      },
    },
    right: {
      style: 'thin',
      color: {
        argb: border,
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
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  return (
    cleaned ||
    fallback
  ).slice(
    0,
    31,
  );
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
      desired.slice(
        0,
        31 - suffix.length,
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
  return type ===
    'cat'
    ? 'CAT SIGNING SHEET'
    : 'EXAM SIGNING SHEET';
}

export async function generateAssessmentSigningSheet(
  bundle: AssessmentMarkbookBundle,
): Promise<Buffer> {
  if (
    bundle.cohorts.length === 0
  ) {
    throw new Error(
      'The signing-sheet bundle has no cohorts.',
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
    `${bundle.unit.name} Signing Sheet`;

  workbook.created =
    bundle.generatedAt;

  const metadataRows: Array<{
    sheetName: string;
    assessmentId: string;
    cohortId: string | null;
    studentId: string;
    admissionNumber: string;
    rowNumber: number;
    attendanceStatus: string;
  }> = [];

  for (
    const cohort of
      bundle.cohorts
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
              state:
                'frozen',
              ySplit: 8,
              showGridLines:
                false,
            },
          ],
          pageSetup: {
            orientation:
              'portrait',
            fitToPage:
              true,
            fitToWidth:
              1,
            fitToHeight:
              0,
            paperSize:
              9,
            margins: {
              left: 0.3,
              right: 0.3,
              top: 0.35,
              bottom: 0.35,
              header: 0.15,
              footer: 0.15,
            },
          },
        },
      );

    sheet.mergeCells(
      'A1:F1',
    );

    sheet.getCell(
      'A1',
    ).value =
      'ACADEMIC PLANNER';

    sheet.getCell(
      'A1',
    ).font = {
      bold: true,
      size: 14,
      color: {
        argb: navy,
      },
    };

    sheet.getCell(
      'A1',
    ).alignment = {
      horizontal:
        'center',
      vertical:
        'middle',
    };

    sheet.mergeCells(
      'A2:F2',
    );

    sheet.getCell(
      'A2',
    ).value =
      assessmentLabel(
        bundle.assessmentType,
      );

    sheet.getCell(
      'A2',
    ).font = {
      bold: true,
      size: 12,
    };

    sheet.getCell(
      'A2',
    ).alignment = {
      horizontal:
        'center',
      vertical:
        'middle',
    };

    sheet.getCell(
      'A4',
    ).value =
      'Unit';

    sheet.mergeCells(
      'B4:C4',
    );

    sheet.getCell(
      'B4',
    ).value =
      bundle.unit.name;

    sheet.getCell(
      'D4',
    ).value =
      'Cohort';

    sheet.mergeCells(
      'E4:F4',
    );

    sheet.getCell(
      'E4',
    ).value =
      cohort.cohortName;

    sheet.getCell(
      'A5',
    ).value =
      'Academic Period';

    sheet.mergeCells(
      'B5:C5',
    );

    sheet.getCell(
      'B5',
    ).value =
      bundle.academicPeriod.name;

    sheet.getCell(
      'D5',
    ).value =
      'Assessment';

    sheet.mergeCells(
      'E5:F5',
    );

    sheet.getCell(
      'E5',
    ).value =
      bundle.assessmentType ===
      'cat'
        ? 'CAT'
        : 'Exam';

    sheet.getCell(
      'A6',
    ).value =
      'Date';

    sheet.mergeCells(
      'B6:C6',
    );

    sheet.getCell(
      'D6',
    ).value =
      'Venue';

    sheet.mergeCells(
      'E6:F6',
    );

    for (
      const address of [
        'A4',
        'D4',
        'A5',
        'D5',
        'A6',
        'D6',
      ]
    ) {
      sheet.getCell(
        address,
      ).font = {
        bold: true,
        size: 9,
        color: {
          argb:
            'FF4B5563',
        },
      };
    }

    const header =
      sheet.getRow(
        8,
      );

    header.values = [
      'No.',
      'Admission Number',
      'Student Name',
      'Signature',
      'Status',
      'Remarks',
    ];

    header.height =
      24;

    header.eachCell(
      (cell) => {
        cell.font = {
          bold: true,
          size: 9,
          color: {
            argb:
              'FFFFFFFF',
          },
        };

        cell.fill = {
          type:
            'pattern',
          pattern:
            'solid',
          fgColor: {
            argb:
              navy,
          },
        };

        cell.alignment = {
          horizontal:
            'center',
          vertical:
            'middle',
          wrapText:
            true,
        };

        applyBorder(
          cell,
        );
      },
    );

    const students =
      [...cohort.students]
        .sort(
          (
            first,
            second,
          ) =>
            compareAdmissionNumbers(
              first.admissionNumber,
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
          9 + index;

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
            ? 'ABSENT'
            : '',
          student.attendanceStatus ===
          'absent'
            ? 'Absent'
            : 'Expected',
          '',
        ];

        row.height =
          25;

        row.eachCell(
          (cell) => {
            cell.font = {
              size: 9,
            };

            cell.alignment = {
              vertical:
                'middle',
              wrapText:
                true,
            };

            applyBorder(
              cell,
            );
          },
        );

        sheet.getCell(
          rowNumber,
          1,
        ).alignment = {
          horizontal:
            'center',
          vertical:
            'middle',
        };

        sheet.getCell(
          rowNumber,
          4,
        ).alignment = {
          horizontal:
            'center',
          vertical:
            'middle',
        };

        sheet.getCell(
          rowNumber,
          5,
        ).alignment = {
          horizontal:
            'center',
          vertical:
            'middle',
        };

        if (
          student.attendanceStatus ===
          'absent'
        ) {
          sheet.getCell(
            rowNumber,
            4,
          ).font = {
            bold: true,
            size: 9,
            color: {
              argb:
                'FF7F1D1D',
            },
          };
        }

        metadataRows.push({
          sheetName:
            sheet.name,
          assessmentId:
            cohort.assessmentId,
          cohortId:
            cohort.cohortId,
          studentId:
            student.studentId,
          admissionNumber:
            student.admissionNumber,
          rowNumber,
          attendanceStatus:
            student.attendanceStatus,
        });
      },
    );

    sheet.columns = [
      {
        width: 7,
      },
      {
        width: 20,
      },
      {
        width: 32,
      },
      {
        width: 24,
      },
      {
        width: 14,
      },
      {
        width: 22,
      },
    ];

    sheet.headerFooter.oddFooter =
      '&LAcademic Planner&CPage &P of &N&ROfficial assessment signing sheet';
  }

  const metadata =
    workbook.addWorksheet(
      '_metadata',
      {
        state:
          'veryHidden',
      },
    );

  metadata.getCell(
    'A1',
  ).value =
    'Template Key';

  metadata.getCell(
    'B1',
  ).value =
    'assessment-signing-sheet';

  metadata.getCell(
    'A2',
  ).value =
    'Template Version';

  metadata.getCell(
    'B2',
  ).value =
    assessmentSigningSheetTemplateVersion;

  metadata.getCell(
    'A3',
  ).value =
    'Root Assessment ID';

  metadata.getCell(
    'B3',
  ).value =
    bundle.rootAssessmentId;

  metadata.getCell(
    'A4',
  ).value =
    'Assessment Type';

  metadata.getCell(
    'B4',
  ).value =
    bundle.assessmentType;

  metadata.getCell(
    'A5',
  ).value =
    'Academic Period ID';

  metadata.getCell(
    'B5',
  ).value =
    bundle.academicPeriod.id;

  metadata.getCell(
    'A6',
  ).value =
    'Unit ID';

  metadata.getCell(
    'B6',
  ).value =
    bundle.unit.id;

  metadata.getCell(
    'A7',
  ).value =
    'Generated At';

  metadata.getCell(
    'B7',
  ).value =
    bundle.generatedAt.toISOString();

  metadata.getRow(
    10,
  ).values = [
    'Sheet',
    'Assessment ID',
    'Cohort ID',
    'Student ID',
    'Admission Number',
    'Workbook Row',
    'Attendance Status',
  ];

  metadataRows.forEach(
    (
      row,
      index,
    ) => {
      metadata.getRow(
        11 + index,
      ).values = [
        row.sheetName,
        row.assessmentId,
        row.cohortId,
        row.studentId,
        row.admissionNumber,
        row.rowNumber,
        row.attendanceStatus,
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
