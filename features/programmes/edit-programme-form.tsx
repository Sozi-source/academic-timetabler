'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import type { AccessibleDepartment } from '@/features/organization/queries';

import { updateProgrammeAction } from './actions';
import { ProgrammeFormFields } from './programme-form-fields';
import {
  initialProgrammeActionState,
  type Programme,
} from './types';

interface EditProgrammeFormProps {
  programme: Programme;
  departments: AccessibleDepartment[];
}

export function EditProgrammeForm({
  programme,
  departments,
}: EditProgrammeFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateProgrammeAction,
      initialProgrammeActionState,
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
        value={programme.id}
      />

      {!programme.isActive ? (
        <FormStatusMessage
          status="warning"
          title="Inactive programme"
          message="This programme remains available for historical records but cannot receive new cohorts or timetable allocations until reactivated."
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

      <ProgrammeFormFields
        state={state}
        programme={programme}
        pending={pending}
        departments={departments}
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
