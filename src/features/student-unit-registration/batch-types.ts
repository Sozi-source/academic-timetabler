export interface BatchRegistrationStudent {
  id: string;
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortId: string | null;
  cohortName: string | null;
  stageId: string | null;
  stageCode: string | null;
  lifecycleStatus: string;
  reportingStatus: 'pending' | 'reported' | 'deferred' | 'dropped_out';
  expectedUnits: number;
  canRegister: boolean;
  eligible: boolean;
  eligibilityReason:
    | 'ready'
    | 'no_stage'
    | 'no_stage_units'
    | 'no_units_on_offer';
}

export interface BatchRegistrationUnit {
  id: string;
  code: string;
  name: string;
  programmeCode: string;
  stageName: string | null;
}

export interface BatchRegistrationCohort {
  id: string;
  name: string;
  studentCount: number;
}

export interface BatchRegistrationContext {
  period: {
    id: string;
    code: string;
    name: string;
  } | null;
  cohorts: BatchRegistrationCohort[];
  students: BatchRegistrationStudent[];
  units: BatchRegistrationUnit[];
}
