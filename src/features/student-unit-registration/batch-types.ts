export interface BatchRegistrationStudent {
  id: string;
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortId: string | null;
  cohortName: string | null;
  stageId: string | null;
  stageCode: string | null;
  expectedUnits: number;
  eligible: boolean;
  eligibilityReason:
    | 'ready'
    | 'no_stage'
    | 'no_stage_units'
    | 'no_units_on_offer';
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
}
