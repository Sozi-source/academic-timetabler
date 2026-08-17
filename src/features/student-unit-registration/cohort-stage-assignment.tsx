'use client';

import { setCohortStageAction } from './cohort-stage-actions';
import type { CohortStageSetup } from './cohort-stage-types';

interface CohortStageAssignmentProps {
  cohortId: string;
  setups: CohortStageSetup[];
}

export function CohortStageAssignment({
  cohortId,
  setups,
}: CohortStageAssignmentProps) {
  const setup = setups.find((item) => item.cohortId === cohortId);

  if (!setup) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Cohort stage
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {setup.programmeCode}
            {' · '}
            {setup.currentStageCode ?? 'Not set'}
          </p>
        </div>

        {!setup.currentStageId ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
            Stage required
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label
            htmlFor="stageId"
            className="text-[11px] font-semibold text-foreground"
          >
            Academic stage
          </label>

          <select
            id="stageId"
            name="stageId"
            defaultValue={setup.currentStageId ?? ''}
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="">Select stage</option>

            {setup.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.code} - {stage.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          formAction={setCohortStageAction}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Set cohort stage
        </button>
      </div>

      <label className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          name="applyMissingStudents"
          value="yes"
          defaultChecked
          className="mt-0.5 h-3.5 w-3.5 rounded border-border"
        />
        <span>
          Apply to active students in this cohort who currently have no stage.
          Existing individual stages are preserved.
        </span>
      </label>
    </div>
  );
}
