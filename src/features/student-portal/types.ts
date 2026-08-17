export type StudentRegistrationSubmissionStatus = 'draft' | 'submitted' | 'verified' | 'returned';

export interface StudentPortalUnit {
  offeringId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  expected: boolean;
  selected: boolean;
}

export interface StudentPortalRegistrationContext {
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    programmeName: string;
    programmeCode: string;
    departmentName: string;
    cohortId: string;
    cohortName: string;
    academicPeriodNumber: number;
  };
  period: { id: string; code: string; name: string } | null;
  submission: {
    id: string;
    status: StudentRegistrationSubmissionStatus;
    hasException: boolean;
    exceptionReason: string | null;
    verificationNote: string | null;
    submittedAt: string | null;
    verifiedAt: string | null;
  } | null;
  units: StudentPortalUnit[];
}
