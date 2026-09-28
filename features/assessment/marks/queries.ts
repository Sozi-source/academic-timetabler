import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { AssessmentMarkImportBatch, AssessmentMarkImportRow } from './types';

export const getAssessmentMarkImportBatch = cache(async (batchId: string) => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from('assessment_mark_import_batches')
    .select(`
      id,assessment_event_id,original_file_name,status,total_rows,valid_rows,invalid_rows,sheet_count,created_at,
      assessment:assessment_events(id,title,assessment_type,unit:units(code,name),academic_period:academic_periods(name))
    `)
    .eq('id', batchId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load marks import: ${error.message}`);
  if (!batch) return null;

  const { data: rows, error: rowsError } = await supabase
    .from('assessment_mark_import_rows')
    .select(`
      id,sheet_name,row_number,admission_number,row_status,errors,component_marks,total_mark,grade,comment,
      student:students(full_name),cohort:cohorts(code,name)
    `)
    .eq('batch_id', batchId)
    .order('sheet_name')
    .order('row_number');
  if (rowsError) throw new Error(`Unable to load mark rows: ${rowsError.message}`);
  return { batch: batch as unknown as AssessmentMarkImportBatch, rows: (rows ?? []) as unknown as AssessmentMarkImportRow[] };
});

export const getAssessmentResultCount = cache(async (assessmentId: string) => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('assessment_results')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_event_id', assessmentId);
  if (error) throw new Error(`Unable to load assessment results count: ${error.message}`);
  return count ?? 0;
});
