export type MarkImportRowStatus = 'ready' | 'invalid';

export interface AssessmentMarkImportRow {
  id: string;
  sheet_name: string;
  row_number: number;
  admission_number: string;
  row_status: MarkImportRowStatus;
  errors: string[];
  component_marks: Record<string, number | null>;
  total_mark: number | null;
  grade: string | null;
  comment: string | null;
  student: { full_name: string } | null;
  cohort: { code: string; name: string } | null;
}

export interface AssessmentMarkImportBatch {
  id: string;
  assessment_event_id: string;
  original_file_name: string;
  status: 'staged' | 'completed' | 'failed';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  sheet_count: number;
  created_at: string;
  assessment: {
    id: string;
    title: string;
    assessment_type: 'cat' | 'exam';
    unit: { code: string; name: string } | null;
    academic_period: { name: string } | null;
  } | null;
}

export interface MarkUploadActionState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  batchId?: string;
}

export const initialMarkUploadActionState: MarkUploadActionState = { status: 'idle' };
