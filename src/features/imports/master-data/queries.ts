import { cache } from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  MasterDataImportBatch,
  MasterDataImportEntity,
  MasterDataImportStagedRow,
} from './types';

export const getMasterDataImportBatch =
  cache(async (
    entity: MasterDataImportEntity,
    batchId: string,
  ): Promise<{
    batch: MasterDataImportBatch;
    rows: MasterDataImportStagedRow[];
  } | null> => {
    const supabase = await createClient();

    const { data: batch, error: batchError } =
      await supabase
        .from('import_batches')
        .select(`
          id,
          entity_type,
          template_version,
          original_file_name,
          file_size_bytes,
          status,
          total_rows,
          valid_rows,
          invalid_rows,
          duplicate_rows,
          imported_rows,
          skipped_rows,
          failed_rows,
          failure_message,
          created_at,
          completed_at
        `)
        .eq('id', batchId)
        .eq('entity_type', entity)
        .maybeSingle();

    if (batchError) {
      throw new Error(
        `Unable to load the import batch: ${batchError.message}`,
      );
    }

    if (!batch) {
      return null;
    }

    const { data: rows, error: rowsError } =
      await supabase
        .from('import_rows')
        .select(`
          id,
          source_row_number,
          status,
          source_data,
          normalized_data,
          field_errors,
          row_errors,
          duplicate_key,
          imported_record_id
        `)
        .eq('import_batch_id', batchId)
        .order('source_row_number', {
          ascending: true,
        });

    if (rowsError) {
      throw new Error(
        `Unable to load staged rows: ${rowsError.message}`,
      );
    }

    return {
      batch: {
        id: batch.id,
        entityType: batch.entity_type,
        templateVersion: batch.template_version,
        originalFileName: batch.original_file_name,
        fileSizeBytes: batch.file_size_bytes,
        status: batch.status,
        totalRows: batch.total_rows,
        validRows: batch.valid_rows,
        invalidRows: batch.invalid_rows,
        duplicateRows: batch.duplicate_rows,
        importedRows: batch.imported_rows,
        skippedRows: batch.skipped_rows,
        failedRows: batch.failed_rows,
        failureMessage: batch.failure_message,
        createdAt: batch.created_at,
        completedAt: batch.completed_at,
      } as MasterDataImportBatch,
      rows: (rows ?? []).map((row) => ({
        id: row.id,
        sourceRowNumber: row.source_row_number,
        status: row.status,
        sourceData: row.source_data,
        normalizedData: row.normalized_data,
        fieldErrors: row.field_errors,
        rowErrors: row.row_errors,
        duplicateKey: row.duplicate_key,
        importedRecordId: row.imported_record_id,
      })) as MasterDataImportStagedRow[],
    };
  });
