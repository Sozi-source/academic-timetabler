export type StudentRegistrationSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'verified'
  | 'returned';

export type StudentPortalRegistrationState =
  | 'not_registered'
  | 'pre_registered'
  | 'confirmed'
  | 'deregistered';

export interface StudentPortalIdentity {
  id: string;
  admissionNumber: string;
  fullName: string;
  programmeName: string;
  programmeCode: string;
  departmentName: string;
  cohortId: string | null;
  cohortName: string | null;
  academicPeriodNumber: number | null;
  lifecycleStatus: string;
  detailsVerifiedAt: string | null;
}

export interface StudentPortalPeriod {
  id: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface StudentPortalUnit {
  registrationId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  registrationStatus: string;
  source: string;
  registeredAt: string;
}

export interface StudentPortalRegistrationContext {
  student: StudentPortalIdentity;
  period: StudentPortalPeriod | null;
  submission: {
    id: string;
    status: StudentRegistrationSubmissionStatus;
    verificationNote: string | null;
    submittedAt: string | null;
    verifiedAt: string | null;
  } | null;
  registrationState: StudentPortalRegistrationState;
  units: StudentPortalUnit[];
}

export interface StudentPortalTimetableSession {
  id: string;
  dayName: string;
  daySequence: number;
  startSequence: number;
  startsAt: string;
  endsAt: string;
  unitId: string;
  unitName: string;
  trainerName: string;
  roomLabel: string;
  deliveryMode: string;
}

export interface StudentPortalResult {
  id: string;
  assessmentId: string;
  assessmentType: 'cat' | 'exam';
  unitId: string;
  unitName: string;
  periodName: string;
  mark: number | null;
  maximumMark: number | null;
  passMark: number | null;
  resultStatus: string;
  publishedAt: string;
}

export interface StudentPortalDocument {
  id: string;
  documentType: string;
  unitName: string;
  versionNumber: number;
  approvedAt: string | null;
}

export interface StudentPortalProfileDetails {
  admissionNumber: string;
  fullName: string;
  kcseIndexNumber: string | null;
  nationalIdNumber: string | null;
  phoneNumber: string | null;
  email: string | null;
  detailsVerifiedAt: string | null;
}
