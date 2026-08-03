'use client';

import {
  GraduationCap,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { createProgrammeAction } from './actions';
import { ProgrammeFormFields } from './programme-form-fields';
import {
  initialProgrammeActionState,
} from './types';

export function CreateProgrammeForm() {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createProgrammeAction,
      initialProgrammeActionState,
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

      <ProgrammeFormFields
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
              <GraduationCap
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