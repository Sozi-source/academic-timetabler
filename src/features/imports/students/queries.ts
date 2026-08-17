import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { StudentImportBatch, StudentImportStagedRow } from './types';

export const getStudentImportBatch = cache(async (batchId: string): Promise<{batch: StudentImportBatch; rows: StudentImportStagedRow[]} | null> => {
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase.from('import_batches').select('id,original_file_name,status,total_rows,valid_rows,invalid_rows,duplicate_rows,imported_rows,skipped_rows,failed_rows').eq('id', batchId).eq('entity_type', 'students').maybeSingle();
  if (batchError) throw new Error(`Unable to load student import batch: ${batchError.message}`);
  if (!batch) return null;
  const { data: rows, error: rowsError } = await supabase.from('import_rows').select('id,source_row_number,status,normalized_data,field_errors,row_errors,imported_record_id').eq('import_batch_id', batchId).order('source_row_number');
  if (rowsError) throw new Error(`Unable to load student import rows: ${rowsError.message}`);
  return {
    batch: {
      id: batch.id, originalFileName: batch.original_file_name, status: batch.status, totalRows: batch.total_rows,
      validRows: batch.valid_rows, invalidRows: batch.invalid_rows, duplicateRows: batch.duplicate_rows,
      importedRows: batch.imported_rows, skippedRows: batch.skipped_rows, failedRows: batch.failed_rows,
    } as StudentImportBatch,
    rows: (rows ?? []).map((row) => ({
      id: row.id, sourceRowNumber: row.source_row_number, status: row.status,
      normalizedData: row.normalized_data ?? {}, fieldErrors: row.field_errors ?? {}, rowErrors: row.row_errors ?? [], importedRecordId: row.imported_record_id,
    })) as StudentImportStagedRow[],
  };
});
