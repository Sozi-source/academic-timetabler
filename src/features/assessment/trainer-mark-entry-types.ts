export interface TrainerMarkInviteRow {
  id: string;
  assessment_id: string;
  department_id: string;
  trainer_name: string;
  trainer_email: string | null;
  token_hash: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  last_accessed_at: string | null;
  submitted_at: string | null;
  revoked_at: string | null;
  parent_invite_id?: string | null;
  cohort_id?: string | null;
  scope_unit_id?: string | null;
}

export interface TrainerMarkEntryRow {
  assessmentId: string;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus: 'expected' | 'absent';
  assignment: number | null;
  presentation: number | null;
  rat: number | null;
  cat: number | null;
  exam: number | null;
}

export type TrainerMarkComponentKey = 'assignment' | 'presentation' | 'rat' | 'cat' | 'exam';

export type TrainerMarkComponentSubmissions = Partial<Record<TrainerMarkComponentKey, string>>;
