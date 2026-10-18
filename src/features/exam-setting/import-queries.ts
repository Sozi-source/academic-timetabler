import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export interface ExamImportBatch {
  id: string;
  sourceFilename: string;
  totalRecords: number;
  status: 'reviewing' | 'imported' | 'cancelled';
  createdAt: string;
}

export interface ExamImportItem {
  id: string;
  sourcePath: string;
  examYear: number | null;
  series: string | null;
  trainerName: string | null;
  paperKind: string | null;
  unitCode: string | null;
  importStatus: string;
  parseError: string | null;
  parseNotes: string[];
  paperPreview: Array<{ label: string; questions: Array<{ number: number; text: string }> }>;
  unitId: string | null;
  reviewStatus: 'pending' | 'ready' | 'rejected' | 'imported';
  sourceFileId: string | null;
}

export interface ExamImportWorkspace {
  departmentName: string;
  units: Array<{ id: string; code: string; name: string }>;
  batches: ExamImportBatch[];
  selectedBatch: ExamImportBatch | null;
  items: ExamImportItem[];
  itemPage: number;
  itemPageCount: number;
  itemCount: number;
  readyCount: number;
  migrationRequired: boolean;
  autoImportMigrationRequired: boolean;
}

const ITEMS_PER_PAGE = 30;

export const getExamImportWorkspace = cache(
  async (requestedBatchId?: string, requestedItemPage = 1): Promise<ExamImportWorkspace> => {
    const profile = await requireHodAccess();
    const empty: ExamImportWorkspace = {
      departmentName: profile.departmentName,
      units: [],
      batches: [],
      selectedBatch: null,
      items: [],
      itemPage: 1,
      itemPageCount: 0,
      itemCount: 0,
      readyCount: 0,
      migrationRequired: false,
      autoImportMigrationRequired: false,
    };
    if (!profile.activeDepartmentId) return empty;

    const supabase = await createClient();
    const [unitResult, batchResult, autoImportCapability] = await Promise.all([
      supabase
        .from('units')
        .select('id,code,name')
        .eq('department_id', profile.activeDepartmentId)
        .eq('is_active', true)
        .order('code', { ascending: true }),
      supabase
        .from('exam_import_batches')
        .select('id,source_filename,total_records,status,created_at')
        .eq('department_id', profile.activeDepartmentId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.rpc('exam_import_partial_commit_enabled'),
    ]);

    if (unitResult.error) throw new Error(`Unable to load units: ${unitResult.error.message}`);
    if (batchResult.error) {
      if (batchResult.error.code === '42P01' || batchResult.error.code === 'PGRST205') {
        return { ...empty, units: unitResult.data ?? [], migrationRequired: true };
      }
      throw new Error(`Unable to load exam import batches: ${batchResult.error.message}`);
    }

    const autoImportMigrationRequired = Boolean(autoImportCapability.error);

    const batches: ExamImportBatch[] = (batchResult.data ?? []).map((row) => ({
      id: row.id,
      sourceFilename: row.source_filename,
      totalRecords: row.total_records,
      status: row.status,
      createdAt: row.created_at,
    }));
    const selectedBatch = batches.find((batch) => batch.id === requestedBatchId) ?? null;
    if (!selectedBatch) {
      return { ...empty, units: unitResult.data ?? [], batches, autoImportMigrationRequired };
    }

    const [{ data: rows, error: itemsError, count: itemCount }, { count: readyCount, error: readyCountError }] = await Promise.all([
      supabase
      .from('exam_import_items')
      .select('id,source_path,exam_year,series,trainer_name,paper_kind,unit_code,import_status,parse_error,parse_notes,paper_preview,unit_id,review_status,source_file_id', { count: 'exact' })
      .eq('batch_id', selectedBatch.id)
      .eq('department_id', profile.activeDepartmentId)
      .eq('review_status', 'pending')
      .order('source_path', { ascending: true })
      .range((Math.max(1, requestedItemPage) - 1) * ITEMS_PER_PAGE, Math.max(1, requestedItemPage) * ITEMS_PER_PAGE - 1),
      supabase.from('exam_import_items')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', selectedBatch.id)
        .eq('department_id', profile.activeDepartmentId)
        .eq('review_status', 'ready'),
    ]);

    if (itemsError) throw new Error(`Unable to load imported papers: ${itemsError.message}`);
    if (readyCountError) throw new Error(`Unable to count confirmed papers: ${readyCountError.message}`);
    const items: ExamImportItem[] = (rows ?? []).map((row) => ({
      id: row.id,
      sourcePath: row.source_path,
      examYear: row.exam_year,
      series: row.series,
      trainerName: row.trainer_name,
      paperKind: row.paper_kind,
      unitCode: row.unit_code,
      importStatus: row.import_status,
      parseError: row.parse_error,
      parseNotes: Array.isArray(row.parse_notes)
        ? row.parse_notes.filter((note): note is string => typeof note === 'string')
        : [],
      paperPreview: Array.isArray(row.paper_preview)
        ? row.paper_preview.flatMap((section) => {
          if (typeof section !== 'object' || section === null || !('label' in section) || !('questions' in section)) return [];
          if (typeof section.label !== 'string' || !Array.isArray(section.questions)) return [];
          const questions = section.questions.flatMap((question) => {
            if (typeof question !== 'object' || question === null || !('number' in question) || !('text' in question)) return [];
            return typeof question.number === 'number' && typeof question.text === 'string'
              ? [{ number: question.number, text: question.text }]
              : [];
          });
          return [{ label: section.label, questions }];
        })
        : [],
      unitId: row.unit_id,
      reviewStatus: row.review_status,
      sourceFileId: row.source_file_id,
    }));

    return {
      departmentName: profile.departmentName,
      units: unitResult.data ?? [],
      batches,
      selectedBatch,
      items,
      itemPage: Math.max(1, requestedItemPage),
      itemPageCount: Math.ceil((itemCount ?? 0) / ITEMS_PER_PAGE),
      itemCount: itemCount ?? 0,
      readyCount: readyCount ?? 0,
      migrationRequired: false,
      autoImportMigrationRequired,
    };
  },
);
