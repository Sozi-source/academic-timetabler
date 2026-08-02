'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { updateTrainerAction } from './actions';
import { TrainerFormFields } from './trainer-form-fields';
import {
  initialTrainerActionState,
  type Trainer,
} from './types';

interface EditTrainerFormProps {
  trainer: Trainer;
}

export function EditTrainerForm({
  trainer,
}: EditTrainerFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateTrainerAction,
      initialTrainerActionState,
    );

  return (
    <form
      action={formAction}
      className="space-y-5"
      noValidate
    >
      <input
        type="hidden"
        name="id"
        value={trainer.id}
      />

      {!trainer.isActive ? (
        <FormStatusMessage
          status="warning"
          title="Inactive trainer"
          message="This trainer remains available for historical records but cannot receive new timetable allocations until reactivated."
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

      <TrainerFormFields
        state={state}
        trainer={trainer}
        pending={pending}
      />

      <div className="flex justify-end border-t border-border-soft pt-5">
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