'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import type { Programme } from '@/features/programmes/types';

import { updateCohortAction } from './actions';
import { CohortFormFields } from './cohort-form-fields';
import {
  initialCohortActionState,
  type Cohort,
} from './types';

interface EditCohortFormProps {
  cohort: Cohort;
  programmes: Programme[];
  academicPeriods: AcademicPeriod[];
}

export function EditCohortForm({
  cohort,
  programmes,
  academicPeriods,
}: EditCohortFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateCohortAction,
      initialCohortActionState,
    );

  return (
    <form
      action={formAction}
      className="space-y-4"
      noValidate
    >
      <input
        type="hidden"
        name="id"
        value={cohort.id}
      />

      {cohort.status === 'archived' ? (
        <FormStatusMessage
          status="warning"
          title="Archived cohort"
          message="This cohort is retained for historical records and is not available for new timetable allocations."
        />
      ) : null}

      {state.message ? (
        <FormStatusMessage
          status={
            state.status === 'success'
              ? 'success'
              : 'error'
          }
          message={state.message}
        />
      ) : null}

      <CohortFormFields
        state={state}
        programmes={programmes}
        academicPeriods={academicPeriods}
        cohort={cohort}
        pending={pending}
      />

      <div className="flex justify-end border-t border-border-soft pt-4">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          leadingIcon={
            pending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Saving changes'
            : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}