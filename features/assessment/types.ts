export type AssessmentType = 'cat' | 'exam';
export type AssessmentStatus = 'draft' | 'open' | 'closed';

export interface AssessmentEventRow {
  id: string;
  title: string;
  assessment_type: AssessmentType;
  assessment_date: string | null;
  max_mark: number;
  pass_mark: number;
  status: AssessmentStatus;
  attendance_finalized_at: string | null;
  cat_marks_finalized_at: string | null;
  exam_marks_finalized_at: string | null;
  academic_period: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  cohort: { id: string; code: string; name: string } | null;
  population: { count: number }[] | null;
}

export interface AssessmentOption {
  id: string;
  code: string;
  name: string;
}

export interface AssessmentSetupOptions {
  periods: Array<AssessmentOption & { status: string }>;
  units: Array<AssessmentOption & { programmeCode: string }>;
  cohorts: Array<AssessmentOption & { programmeId: string }>;
}

export interface AssessmentOverview {
  total: number;
  cats: number;
  exams: number;
  draft: number;
  open: number;
  candidates: number;
}

export interface AssessmentCandidateRow {
  id: string;
  population_status: 'expected' | 'excluded';
  attendance_status: 'pending' | 'present' | 'absent';
  cat_absence_reason?: string | null;
  cat_absence_recommendation?: string | null;
  exam_absence_reason?: string | null;
  exam_absence_recommendation?: string | null;
  student: {
    id: string;
    admission_number: string;
    full_name: string;
  } | null;
  cohort: { id: string; code: string; name: string } | null;
}
