'use client';

import {
  LoaderCircle,
  UserPlus,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { createTrainerAction } from './actions';
import { TrainerFormFields } from './trainer-form-fields';
import {
  initialTrainerActionState,
} from './types';

export function CreateTrainerForm() {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createTrainerAction,
      initialTrainerActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
    >
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
              <UserPlus
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Saving'
            : 'Save'}
        </Button>
      </div>
    </form>
  );
}