export interface AssessmentAnalysisEvent {
  id: string;
  title: string;
  assessment_type: 'cat' | 'exam';
  assessment_date: string | null;
  max_mark: number;
  pass_mark: number;
  status: 'draft' | 'open' | 'closed';
  attendance_finalized_at: string | null;
  academic_period: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
}

export interface AssessmentAnalysisStudent {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  attendanceStatus: 'pending' | 'present' | 'absent';
  componentMarks: Record<string, number | null> | null;
  totalMark: number | null;
  grade: string | null;
  comment: string | null;
}

export interface CohortAnalysisRow {
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  expected: number;
  present: number;
  absent: number;
  marked: number;
  missingMarks: number;
  passed: number;
  failed: number;
  mean: number | null;
}

export interface AssessmentAnalysis {
  event: AssessmentAnalysisEvent;
  students: AssessmentAnalysisStudent[];
  cohorts: CohortAnalysisRow[];
  expected: number;
  present: number;
  absent: number;
  marked: number;
  missingMarks: number;
  passed: number;
  failed: number;
  passRate: number | null;
  mean: number | null;
  highest: number | null;
  lowest: number | null;
  courseworkMean: number | null;
  examMean: number | null;
}
