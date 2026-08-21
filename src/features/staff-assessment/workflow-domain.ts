export interface StaffAssessmentWorkflowState {
  workflowStatus: string | null;
  populationLocked: boolean;
  populationCount: number;
  ruleConfigured: boolean;
}

function terminal(
  status: string | null,
): boolean {
  return (
    status ===
      'submitted' ||
    status ===
      'finalised' ||
    status ===
      'archived'
  );
}

export function canGenerateStaffPopulation(
  state: StaffAssessmentWorkflowState,
): boolean {
  return (
    !terminal(
      state.workflowStatus,
    ) &&
    !state.populationLocked
  );
}

export function canEditStaffAttendance(
  state: StaffAssessmentWorkflowState,
): boolean {
  return (
    state.populationCount >
      0 &&
    !state.populationLocked &&
    !terminal(
      state.workflowStatus,
    )
  );
}

export function canDownloadStaffMarkbook(
  state: StaffAssessmentWorkflowState,
): boolean {
  return (
    state.populationCount >
      0 &&
    !terminal(
      state.workflowStatus,
    )
  );
}

export function canDownloadStaffSigningSheet(
  state: StaffAssessmentWorkflowState,
): boolean {
  return (
    state.populationCount >
      0 &&
    state.populationLocked
  );
}

export function canStageStaffMarkbook(
  state: StaffAssessmentWorkflowState,
): boolean {
  return (
    state.populationCount >
      0 &&
    state.populationLocked &&
    state.ruleConfigured &&
    !terminal(
      state.workflowStatus,
    )
  );
}

export function canCommitStaffBatch({
  status,
  totalRows,
  missingMarks,
}: {
  status: string;
  totalRows: number;
  missingMarks: number;
}): boolean {
  return (
    status ===
      'ready' &&
    totalRows >
      0 &&
    missingMarks ===
      0
  );
}
