export interface RegistrationPeriod {
  id: string;
  code: string;
  name: string;
}

export type DepartmentRegistrationStatus = 'not_submitted' | 'draft' | 'submitted' | 'verified' | 'returned';

export interface RegistrationStudent {
  id: string;
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortId: string | null;
  cohortName: string | null;
  expectedUnits: number;
  selectedUnits: number;
  submissionId: string | null;
  status: DepartmentRegistrationStatus;
  hasException: boolean;
  exceptionReason: string | null;
  verificationNote: string | null;
}

export interface UnitRegistrationContext {
  period: RegistrationPeriod | null;
  students: RegistrationStudent[];
  expectedUnitTotal: number;
  selectedUnitTotal: number;
  submittedCount: number;
  verifiedCount: number;
  exceptionCount: number;
}


export interface DepartmentRegistrationUnit {
  id: string;
  code: string;
  name: string;
  isExpected: boolean;
  isSelected: boolean;
  category?: 'expected' | 'offered' | 'curriculum';
  stageName?: string | null;
  stageCode?: string | null;
}

export interface DepartmentRegistrationEditor {
  period: RegistrationPeriod;
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    programmeCode: string;
    cohortName: string;
    currentStageId: string | null;
    currentStageName: string | null;
  };
  stageOptions: ProgrammeStageOption[];
  units: DepartmentRegistrationUnit[];
  existingStatus: DepartmentRegistrationStatus;
  existingNote: string | null;
}

export interface ProgrammeStageOption {
  id: string;
  code: string;
  name: string;
  sequenceNumber: number;
}

export interface ProgrammeStageSetup {
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  stages: Array<{
    id: string;
    code: string;
    name: string;
    sequenceNumber: number;
    unitIds: string[];
  }>;
  units: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}
