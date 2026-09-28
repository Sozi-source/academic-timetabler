export type StudentPortalAccessStatus =
  | 'not_issued'
  | 'active'
  | 'disabled'
  | 'locked';

export interface StudentPortalAccessRow {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortName: string;
  lifecycleStatus: string;
  hasCredential: boolean;
  isActive: boolean;
  issuedAt: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

export interface StudentPortalAccessSummary {
  eligible: number;
  issued: number;
  active: number;
  notIssued: number;
  disabled: number;
  locked: number;
  neverSignedIn: number;
}
