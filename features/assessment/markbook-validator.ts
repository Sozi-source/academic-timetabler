import ExcelJS from 'exceljs';

import {
  assessmentMarkbookTemplateVersion,
} from './markbook-generator';

export type AssessmentWorkbookIssueCode =
  | 'invalid_template'
  | 'wrong_assessment'
  | 'missing_sheet'
  | 'student_row_changed'
  | 'attendance_changed'
  | 'invalid_mark'
  | 'absence_mismatch';

export interface AssessmentWorkbookIssue {
  code:
    AssessmentWorkbookIssueCode;
  message: string;
  sheetName?: string;
  workbookRow?: number;
  admissionNumber?: string;
}

export interface AssessmentWorkbookValidationRow {
  sheetName: string;
  assessmentId: string;
  cohortId: string | null;
  studentId: string;
  admissionNumber: string;
  workbookRow: number;
  attendanceStatus:
    | 'expected'
    | 'absent';
  mark:
    | number
    | 'AB'
    | null;
  resultStatus:
    | 'sat'
    | 'absent'
    | 'missing_mark';
}

export interface AssessmentWorkbookValidationResult {
  valid: boolean;
  templateVersion: string | null;
  generationId: string | null;
  rootAssessmentId: string | null;
  assessmentType:
    | 'cat'
    | 'exam'
    | null;
  academicPeriodId: string | null;
  unitId: string | null;
  totalRows: number;
  numericMarks: number;
  absences: number;
  missingMarks: number;
  issues: AssessmentWorkbookIssue[];
  rows: AssessmentWorkbookValidationRow[];
}

function textValue(
  value: ExcelJS.CellValue,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  if (
    typeof value ===
      'string' ||
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return String(
      value,
    ).trim();
  }

  if (
    typeof value ===
      'object' &&
    'text' in value &&
    typeof value.text ===
      'string'
  ) {
    return value.text.trim();
  }

  return '';
}

function numericValue(
  value: ExcelJS.CellValue,
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  return null;
}

export async function validateAssessmentMarkbook(
  input: Buffer,
  expectedRootAssessmentId?: string,
  maximumMark?: number | null,
): Promise<AssessmentWorkbookValidationResult> {
  const workbook =
    new ExcelJS.Workbook();

  await workbook.xlsx.load(
    input as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0],
  );

  const issues:
    AssessmentWorkbookIssue[] =
      [];

  const metadata =
    workbook.getWorksheet(
      '_metadata',
    );

  if (!metadata) {
    return {
      valid: false,
      templateVersion:
        null,
      generationId:
        null,
      rootAssessmentId:
        null,
      assessmentType:
        null,
      academicPeriodId:
        null,
      unitId:
        null,
      totalRows: 0,
      numericMarks: 0,
      absences: 0,
      missingMarks: 0,
      issues: [
        {
          code:
            'invalid_template',
          message:
            'The protected markbook metadata sheet is missing.',
        },
      ],
      rows: [],
    };
  }

  const templateKey =
    textValue(
      metadata.getCell(
        'B1',
      ).value,
    );

  const templateVersion =
    textValue(
      metadata.getCell(
        'B2',
      ).value,
    ) || null;

  const generationId =
    textValue(
      metadata.getCell(
        'B3',
      ).value,
    ) || null;

  const rootAssessmentId =
    textValue(
      metadata.getCell(
        'B4',
      ).value,
    ) || null;

  const typeValue =
    textValue(
      metadata.getCell(
        'B5',
      ).value,
    );

  const assessmentType =
    typeValue ===
      'cat'
      ? 'cat'
      : typeValue ===
          'exam'
        ? 'exam'
        : null;

  const academicPeriodId =
    textValue(
      metadata.getCell(
        'B6',
      ).value,
    ) || null;

  const unitId =
    textValue(
      metadata.getCell(
        'B7',
      ).value,
    ) || null;

  if (
    templateKey !==
    'assessment-markbook'
  ) {
    issues.push({
      code:
        'invalid_template',
      message:
        'This workbook is not an Academic Planner assessment markbook.',
    });
  }

  if (
    templateVersion !==
    assessmentMarkbookTemplateVersion
  ) {
    issues.push({
      code:
        'invalid_template',
      message:
        `Unsupported markbook template version: ${templateVersion ?? 'unknown'}.`,
    });
  }

  if (
    expectedRootAssessmentId &&
    rootAssessmentId !==
      expectedRootAssessmentId
  ) {
    issues.push({
      code:
        'wrong_assessment',
      message:
        'This workbook belongs to a different assessment.',
    });
  }

  const rows:
    AssessmentWorkbookValidationRow[] =
      [];

  let metadataRow =
    13;

  while (true) {
    const sheetName =
      textValue(
        metadata.getCell(
          metadataRow,
          1,
        ).value,
      );

    if (!sheetName) {
      break;
    }

    const assessmentId =
      textValue(
        metadata.getCell(
          metadataRow,
          2,
        ).value,
      );

    const cohortIdText =
      textValue(
        metadata.getCell(
          metadataRow,
          3,
        ).value,
      );

    const studentId =
      textValue(
        metadata.getCell(
          metadataRow,
          5,
        ).value,
      );

    const admissionNumber =
      textValue(
        metadata.getCell(
          metadataRow,
          6,
        ).value,
      );

    const workbookRowValue =
      metadata.getCell(
        metadataRow,
        7,
      ).value;

    const attendanceText =
      textValue(
        metadata.getCell(
          metadataRow,
          8,
        ).value,
      );

    const workbookRow =
      typeof workbookRowValue ===
        'number'
        ? workbookRowValue
        : Number(
            textValue(
              workbookRowValue,
            ),
          );

    const attendanceStatus =
      attendanceText ===
      'absent'
        ? 'absent'
        : 'expected';

    const sheet =
      workbook.getWorksheet(
        sheetName,
      );

    if (!sheet) {
      issues.push({
        code:
          'missing_sheet',
        message:
          `Worksheet "${sheetName}" is missing or was renamed.`,
        sheetName,
        admissionNumber,
      });

      metadataRow +=
        1;

      continue;
    }

    if (
      !Number.isInteger(
        workbookRow,
      ) ||
      workbookRow < 1
    ) {
      issues.push({
        code:
          'student_row_changed',
        message:
          'A protected student-row reference is invalid.',
        sheetName,
        admissionNumber,
      });

      metadataRow +=
        1;

      continue;
    }

    const visibleAdmission =
      textValue(
        sheet.getCell(
          workbookRow,
          2,
        ).value,
      );

    const visibleAttendance =
      textValue(
        sheet.getCell(
          workbookRow,
          4,
        ).value,
      ).toLowerCase();

    const markCell =
      sheet.getCell(
        workbookRow,
        5,
      ).value;

    if (
      visibleAdmission !==
      admissionNumber
    ) {
      issues.push({
        code:
          'student_row_changed',
        message:
          'The admission number no longer matches the protected workbook roster.',
        sheetName,
        workbookRow,
        admissionNumber,
      });
    }

    const expectedVisibleAttendance =
      attendanceStatus ===
      'absent'
        ? 'absent'
        : 'expected';

    if (
      visibleAttendance !==
      expectedVisibleAttendance
    ) {
      issues.push({
        code:
          'attendance_changed',
        message:
          'Attendance was changed inside Excel. Record assessment absences online before generating the workbook.',
        sheetName,
        workbookRow,
        admissionNumber,
      });
    }

    let mark:
      | number
      | 'AB'
      | null =
        null;

    let resultStatus:
      | 'sat'
      | 'absent'
      | 'missing_mark' =
        'missing_mark';

    if (
      attendanceStatus ===
      'absent'
    ) {
      const markText =
        textValue(
          markCell,
        ).toUpperCase();

      if (
        markText !==
        'AB'
      ) {
        issues.push({
          code:
            'absence_mismatch',
          message:
            'An online absence must remain AB in the workbook.',
          sheetName,
          workbookRow,
          admissionNumber,
        });
      }

      mark =
        'AB';

      resultStatus =
        'absent';
    } else {
      const numeric =
        numericValue(
          markCell,
        );

      const markText =
        textValue(
          markCell,
        );

      if (
        numeric !==
        null
      ) {
        if (
          numeric < 0
        ) {
          issues.push({
            code:
              'invalid_mark',
            message:
              'Marks cannot be negative.',
            sheetName,
            workbookRow,
            admissionNumber,
          });
        } else if (
          typeof maximumMark ===
            'number' &&
          Number.isFinite(
            maximumMark,
          ) &&
          numeric >
            maximumMark
        ) {
          issues.push({
            code:
              'invalid_mark',
            message:
              `Mark exceeds the configured maximum of ${maximumMark}.`,
            sheetName,
            workbookRow,
            admissionNumber,
          });
        } else {
          mark =
            numeric;

          resultStatus =
            'sat';
        }
      } else if (
        markText ===
        ''
      ) {
        mark =
          null;

        resultStatus =
          'missing_mark';
      } else if (
        markText.toUpperCase() ===
        'AB'
      ) {
        issues.push({
          code:
            'absence_mismatch',
          message:
            'AB was typed into Excel for a student who was not marked absent online.',
          sheetName,
          workbookRow,
          admissionNumber,
        });

        mark =
          'AB';

        resultStatus =
          'absent';
      } else {
        issues.push({
          code:
            'invalid_mark',
          message:
            'Enter a numeric mark only. Blank means missing mark; absence must be recorded online.',
          sheetName,
          workbookRow,
          admissionNumber,
        });
      }
    }

    rows.push({
      sheetName,
      assessmentId,
      cohortId:
        cohortIdText ||
        null,
      studentId,
      admissionNumber,
      workbookRow,
      attendanceStatus,
      mark,
      resultStatus,
    });

    metadataRow +=
      1;
  }

  const numericMarks =
    rows.filter(
      (row) =>
        typeof row.mark ===
        'number',
    ).length;

  const absences =
    rows.filter(
      (row) =>
        row.resultStatus ===
        'absent',
    ).length;

  const missingMarks =
    rows.filter(
      (row) =>
        row.resultStatus ===
        'missing_mark',
    ).length;

  if (
    rows.length === 0
  ) {
    issues.push({
      code:
        'invalid_template',
      message:
        'The protected markbook roster is empty.',
    });
  }

  return {
    valid:
      issues.length ===
      0,
    templateVersion,
    generationId,
    rootAssessmentId,
    assessmentType,
    academicPeriodId,
    unitId,
    totalRows:
      rows.length,
    numericMarks,
    absences,
    missingMarks,
    issues,
    rows,
  };
}
