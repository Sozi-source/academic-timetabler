import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  CurriculumImportBatch,
  CurriculumImportStagedRow,
} from './types';

export const getCurriculumImportBatch = cache(
  async (batchId: string): Promise<{
    batch: CurriculumImportBatch;
    rows: CurriculumImportStagedRow[];
  } | null> => {
    const supabase = await createClient();

    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .select(`
        id,template_version,original_file_name,status,total_rows,valid_rows,
        invalid_rows,duplicate_rows,imported_rows,skipped_rows,failed_rows,failure_message
      `)
      .eq('id', batchId)
      .eq('entity_type', 'curriculum')
      .maybeSingle();

    if (batchError) throw new Error(`Unable to load Curriculum import: ${batchError.message}`);
    if (!batch) return null;

    const { data: rows, error: rowsError } = await supabase
      .from('import_rows')
      .select('id,source_row_number,status,normalized_data,field_errors,row_errors')
      .eq('import_batch_id', batchId)
      .order('source_row_number');

    if (rowsError) throw new Error(`Unable to load Curriculum rows: ${rowsError.message}`);

    return {
      batch: {
        id: batch.id,
        templateVersion: batch.template_version,
        originalFileName: batch.original_file_name,
        status: batch.status,
        totalRows: batch.total_rows,
        validRows: batch.valid_rows,
        invalidRows: batch.invalid_rows,
        duplicateRows: batch.duplicate_rows,
        importedRows: batch.imported_rows,
        skippedRows: batch.skipped_rows,
        failedRows: batch.failed_rows,
        failureMessage: batch.failure_message,
      },
      rows: (rows ?? []).map((row) => ({
        id: row.id,
        sourceRowNumber: row.source_row_number,
        status: row.status,
        normalizedData: row.normalized_data ?? {},
        fieldErrors: row.field_errors ?? {},
        rowErrors: row.row_errors ?? [],
      })),
    };
  },
);
