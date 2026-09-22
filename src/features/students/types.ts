export type StudentLifecycleStatus =
  | 'admitted'
  | 'active'
  | 'deferred'
  | 'dropped_out'
  | 'suspended'
  | 'completed'
  | 'graduated'
  | 'on_leave'
  | 'withdrawn'
  | 'discontinued';

export type StudentLifecycleEventType =
  | 'admission'
  | 'cohort_assignment'
  | 'cohort_change'
  | 'deferral'
  | 'resumption'
  | 'dropout'
  | 'suspension'
  | 'programme_completion'
  | 'graduation'
  | 'administrative_correction'
  | 'leave_started'
  | 'leave_ended'
  | 'withdrawal'
  | 'discontinuation';

export type StudentAcademicPhase =
  | 'in_class'
  | 'clinical_rotation'
  | 'attachment'
  | 'deferred'
  | 'dropped_out'
  | 'awaiting_graduation'
  | 'graduated';

export interface StudentSummary {
  total: number;
  active: number;
  deferred: number;
  droppedOut: number;
  completed: number;
  graduated: number;
  attachment: number;
}

export interface StudentRow {
  id: string;
  admission_number: string;
  full_name: string;
  lifecycle_status: StudentLifecycleStatus;
  academic_phase: StudentAcademicPhase;
  reporting_status?: 'pending' | 'reported' | 'deferred' | 'dropped_out' | null;
  completion_date: string | null;
  graduation_date: string | null;
  admission_date: string | null;
  projected_completion_date: string | null;
  kcse_index_number: string | null;
  national_id_number: string | null;
  phone_number: string | null;
  email: string | null;
  details_verified_at: string | null;
  programme: { id?: string; code: string; name: string } | null;
  admission_cohort: { id?: string; code: string; name: string } | null;
  current_cohort: { id?: string; code: string; name: string } | null;
}

export interface StudentDetail extends StudentRow {
  department_id: string;
  programme_id: string;
  admission_cohort_id: string;
  current_cohort_id: string | null;
  notes: string | null;
}

export interface StudentLifecycleEvent {
  id: string;
  event_type: StudentLifecycleEventType;
  effective_date: string;
  expected_resume_date: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  from_cohort: { id: string; code: string; name: string } | null;
  to_cohort: { id: string; code: string; name: string } | null;
}

export interface StudentCohortOption {
  id: string;
  code: string;
  name: string;
  intakeDate: string;
  expectedCompletionDate: string;
}

export interface StudentProgressionActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    eventType?: string[];
    effectiveDate?: string[];
    targetStatus?: string[];
    targetCohortId?: string[];
    expectedResumeDate?: string[];
    reason?: string[];
    notes?: string[];
  };
}

export const initialStudentProgressionActionState: StudentProgressionActionState = {
  status: 'idle',
  message: null,
};

export interface UpdateAdmissionNumberActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  newAdmissionNumber?: string;
  fieldErrors?: {
    studentId?: string[];
    admissionNumber?: string[];
    reason?: string[];
    notes?: string[];
  };
}

export const initialUpdateAdmissionNumberActionState: UpdateAdmissionNumberActionState = {
  status: 'idle',
  message: null,
};

export interface BatchStudentActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  updatedCount?: number;
  fieldErrors?: Record<string, string[]>;
}

export const initialBatchStudentActionState: BatchStudentActionState = {
  status: 'idle',
  message: null,
};


