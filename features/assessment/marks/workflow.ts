export type UnitMarkbookStage =
  | 'population_empty'
  | 'coursework'
  | 'attendance'
  | 'exam'
  | 'complete';

export interface UnitMarkbookWorkflowInput {
  populationCount: number;
  catFinalizedAt?: string | null;
  attendanceFinalizedAt?: string | null;
  examFinalizedAt?: string | null;
}

export function getUnitMarkbookStage(input: UnitMarkbookWorkflowInput): UnitMarkbookStage {
  if (input.examFinalizedAt) return 'complete';
  if (input.populationCount === 0) return 'population_empty';
  if (input.attendanceFinalizedAt) return 'exam';
  if (input.catFinalizedAt) return 'attendance';
  return 'coursework';
}

export function unitMarkbookStageLabel(stage: UnitMarkbookStage) {
  switch (stage) {
    case 'population_empty': return 'Population required';
    case 'coursework': return 'Coursework in progress';
    case 'attendance': return 'Exam attendance pending';
    case 'exam': return 'Exam marks pending';
    case 'complete': return 'Complete';
  }
}
