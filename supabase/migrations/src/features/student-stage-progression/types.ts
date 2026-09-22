export interface StageProgressionStudent {
  id: string;
  admissionNumber: string;
  fullName: string;
  programmeCode: string;
  cohortId: string | null;
  cohortName: string | null;
  currentStageCode: string | null;
  currentStageName: string | null;
  nextStageCode: string | null;
  nextStageName: string | null;
  eligible: boolean;
  terminal: boolean;
}

export interface StageProgressionCohort {
  id: string;
  name: string;
  studentCount: number;
}

export interface StageProgressionContext {
  cohorts: StageProgressionCohort[];
  students: StageProgressionStudent[];
}
