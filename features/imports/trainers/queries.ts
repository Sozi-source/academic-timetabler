import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TrainerImportBatch,
  TrainerImportStagedRow,
} from './types';

interface ImportBatchRow {
  id: string;
  entity_type: 'trainers';
  template_version: string;
  original_file_name: string;
  file_size_bytes: number | null;
  status: TrainerImportBatch['status'];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  failure_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ImportStagedRow {
  id: string;
  source_row_number: number;
  status: TrainerImportStagedRow['status'];
  source_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  field_errors: Record<string, string[]>;
  row_errors: string[];
  duplicate_key: string | null;
  imported_record_id: string | null;
}

function mapBatch(
  row: ImportBatchRow,
): TrainerImportBatch {
  return {
    id: row.id,
    entityType: row.entity_type,
    templateVersion:
      row.template_version,
    originalFileName:
      row.original_file_name,
    fileSizeBytes:
      row.file_size_bytes,
    status: row.status,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    invalidRows: row.invalid_rows,
    duplicateRows: row.duplicate_rows,
    importedRows: row.imported_rows,
    skippedRows: row.skipped_rows,
    failedRows: row.failed_rows,
    failureMessage:
      row.failure_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapStagedRow(
  row: ImportStagedRow,
): TrainerImportStagedRow {
  return {
    id: row.id,
    sourceRowNumber:
      row.source_row_number,
    status: row.status,
    sourceData: row.source_data,
    normalizedData:
      row.normalized_data,
    fieldErrors: row.field_errors,
    rowErrors: row.row_errors,
    duplicateKey: row.duplicate_key,
    importedRecordId:
      row.imported_record_id,
  } as TrainerImportStagedRow;
}

export const getTrainerImportBatch =
  cache(
    async (
      batchId: string,
    ): Promise<{
      batch: TrainerImportBatch;
      rows: TrainerImportStagedRow[];
    } | null> => {
      const supabase =
        await createClient();

      const {
        data: batch,
        error: batchError,
      } = await supabase
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
        .eq('entity_type', 'trainers')
        .maybeSingle();

      if (batchError) {
        throw new Error(
          `Unable to load the import batch: ${batchError.message}`,
        );
      }

      if (!batch) {
        return null;
      }

      const {
        data: rows,
        error: rowsError,
      } = await supabase
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
        batch: mapBatch(
          batch as ImportBatchRow,
        ),
        rows: (
          (rows ?? []) as ImportStagedRow[]
        ).map(mapStagedRow),
      };
    },
  );