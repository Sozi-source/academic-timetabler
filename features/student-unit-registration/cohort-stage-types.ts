export interface CohortStageOption {
  id: string;
  code: string;
  name: string;
  sequenceNumber: number;
}

export interface CohortStageSetup {
  cohortId: string;
  cohortName: string;
  programmeId: string;
  programmeCode: string;
  currentStageId: string | null;
  currentStageCode: string | null;
  stages: CohortStageOption[];
}
