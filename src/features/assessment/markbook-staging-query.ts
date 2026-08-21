import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value: unknown,
): number | null {
  return typeof value ===
    'number'
    ? value
    : null;
}

export interface StagedAssessmentMarkRow {
  id: string;
  assessmentId: string;
  cohortId: string | null;
  studentId: string;
  sheetName: string;
  workbookRow: number;
  admissionNumber: string;
  attendanceStatus: string;
  mark: number | null;
  resultStatus: string;
}

export interface StagedAssessmentMarkbook {
  id: string;
  rootAssessmentId: string;
  generationId: string;
  assessmentType: string;
  sourceFilename: string;
  status: string;
  totalRows: number;
  numericMarks: number;
  absences: number;
  missingMarks: number;
  createdAt: string;
  unitName: string;
  academicPeriodName: string;
  rows: StagedAssessmentMarkRow[];
}

export const getStagedAssessmentMarkbook =
  cache(async (
    batchId: string,
  ): Promise<StagedAssessmentMarkbook> => {
    const supabase =
      await createClient();

    const {
      data: batchData,
      error: batchError,
    } = await supabase
      .from(
        'assessment_markbook_import_batches',
      )
      .select('*')
      .eq(
        'id',
        batchId,
      )
      .maybeSingle();

    if (batchError) {
      throw new Error(
        `Unable to load staged markbook: ${batchError.message}`,
      );
    }

    if (!batchData) {
      throw new Error(
        'Staged markbook was not found.',
      );
    }

    const batch =
      batchData as UnknownRow;

    const unitId =
      asString(
        batch.unit_id,
      );

    const periodId =
      asString(
        batch.academic_period_id,
      );

    if (
      !unitId ||
      !periodId
    ) {
      throw new Error(
        'Staged markbook reference data is incomplete.',
      );
    }

    const [
      unitResult,
      periodResult,
      rowsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'units',
          )
          .select(
            'id, name',
          )
          .eq(
            'id',
            unitId,
          )
          .maybeSingle(),

        supabase
          .from(
            'academic_periods',
          )
          .select(
            'id, name',
          )
          .eq(
            'id',
            periodId,
          )
          .maybeSingle(),

        supabase
          .from(
            'assessment_markbook_import_stage_rows',
          )
          .select('*')
          .eq(
            'batch_id',
            batchId,
          )
          .order(
            'sheet_name',
            {
              ascending:
                true,
            },
          )
          .order(
            'workbook_row',
            {
              ascending:
                true,
            },
          ),
      ]);

    const error =
      unitResult.error ??
      periodResult.error ??
      rowsResult.error;

    if (error) {
      throw new Error(
        `Unable to load staged markbook detail: ${error.message}`,
      );
    }

    if (
      !unitResult.data ||
      !periodResult.data
    ) {
      throw new Error(
        'Staged markbook reference data is incomplete.',
      );
    }

    const rows =
      (
        rowsResult.data ??
        []
      ).map(
        (row) => {
          const raw =
            row as UnknownRow;

          return {
            id:
              asString(
                raw.id,
              ) ??
              '',
            assessmentId:
              asString(
                raw.assessment_id,
              ) ??
              '',
            cohortId:
              asString(
                raw.cohort_id,
              ),
            studentId:
              asString(
                raw.student_id,
              ) ??
              '',
            sheetName:
              asString(
                raw.sheet_name,
              ) ??
              '',
            workbookRow:
              asNumber(
                raw.workbook_row,
              ) ??
              0,
            admissionNumber:
              asString(
                raw.admission_number,
              ) ??
              '',
            attendanceStatus:
              asString(
                raw.attendance_status,
              ) ??
              '',
            mark:
              asNumber(
                raw.mark,
              ),
            resultStatus:
              asString(
                raw.result_status,
              ) ??
              '',
          } satisfies
            StagedAssessmentMarkRow;
        },
      );

    return {
      id:
        asString(
          batch.id,
        ) ??
        batchId,
      rootAssessmentId:
        asString(
          batch.root_assessment_id,
        ) ??
        '',
      generationId:
        asString(
          batch.generation_id,
        ) ??
        '',
      assessmentType:
        asString(
          batch.assessment_type,
        ) ??
        '',
      sourceFilename:
        asString(
          batch.source_filename,
        ) ??
        '',
      status:
        asString(
          batch.status,
        ) ??
        'ready',
      totalRows:
        asNumber(
          batch.total_rows,
        ) ??
        rows.length,
      numericMarks:
        asNumber(
          batch.numeric_marks,
        ) ??
        0,
      absences:
        asNumber(
          batch.absences,
        ) ??
        0,
      missingMarks:
        asNumber(
          batch.missing_marks,
        ) ??
        0,
      createdAt:
        asString(
          batch.created_at,
        ) ??
        '',
      unitName:
        unitResult.data.name,
      academicPeriodName:
        periodResult.data.name,
      rows,
    };
  });
