import type {
  AssessmentWorkbookValidationResult,
} from './markbook-validator';

export interface AssessmentMarkbookStageRow {
  sheetName: string;
  assessmentId: string;
  cohortId: string | null;
  studentId: string;
  admissionNumber: string;
  workbookRow: number;
  attendanceStatus:
    | 'expected'
    | 'absent';
  mark: number | null;
  resultStatus:
    | 'sat'
    | 'absent'
    | 'missing_mark';
}

export interface AssessmentMarkbookStagePayload {
  generationId: string;
  rootAssessmentId: string;
  templateVersion: string;
  assessmentType:
    | 'cat'
    | 'exam';
  academicPeriodId: string;
  unitId: string;
  filename: string;
  sha256: string;
  validationSummary: {
    totalRows: number;
    numericMarks: number;
    absences: number;
    missingMarks: number;
  };
  rows: AssessmentMarkbookStageRow[];
}

export function buildAssessmentMarkbookStagePayload({
  validation,
  filename,
  sha256,
}: {
  validation: AssessmentWorkbookValidationResult;
  filename: string;
  sha256: string;
}): AssessmentMarkbookStagePayload {
  if (!validation.valid) {
    throw new Error(
      'Only a valid assessment workbook can be staged.',
    );
  }

  if (
    !validation.generationId ||
    !validation.rootAssessmentId ||
    !validation.templateVersion ||
    !validation.assessmentType ||
    !validation.academicPeriodId ||
    !validation.unitId
  ) {
    throw new Error(
      'The validated workbook is missing protected metadata.',
    );
  }

  if (
    !/^[0-9a-f]{64}$/.test(
      sha256,
    )
  ) {
    throw new Error(
      'Workbook fingerprint is invalid.',
    );
  }

  const rows =
    validation.rows.map(
      (row) => ({
        sheetName:
          row.sheetName,
        assessmentId:
          row.assessmentId,
        cohortId:
          row.cohortId,
        studentId:
          row.studentId,
        admissionNumber:
          row.admissionNumber,
        workbookRow:
          row.workbookRow,
        attendanceStatus:
          row.attendanceStatus,
        mark:
          typeof row.mark ===
          'number'
            ? row.mark
            : null,
        resultStatus:
          row.resultStatus,
      }),
    );

  return {
    generationId:
      validation.generationId,
    rootAssessmentId:
      validation.rootAssessmentId,
    templateVersion:
      validation.templateVersion,
    assessmentType:
      validation.assessmentType,
    academicPeriodId:
      validation.academicPeriodId,
    unitId:
      validation.unitId,
    filename,
    sha256,
    validationSummary: {
      totalRows:
        validation.totalRows,
      numericMarks:
        validation.numericMarks,
      absences:
        validation.absences,
      missingMarks:
        validation.missingMarks,
    },
    rows,
  };
}
