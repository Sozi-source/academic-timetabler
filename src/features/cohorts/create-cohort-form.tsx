'use client';

import {
  LoaderCircle,
  UsersRound,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import type { Programme } from '@/features/programmes/types';

import { createCohortAction } from './actions';
import { CohortFormFields } from './cohort-form-fields';
import {
  initialCohortActionState,
} from './types';

interface CreateCohortFormProps {
  programmes: Programme[];
}

export function CreateCohortForm({
  programmes,
}: CreateCohortFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createCohortAction,
      initialCohortActionState,
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
      className="space-y-5"
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

      <CohortFormFields
        state={state}
        programmes={programmes}
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
              <UsersRound
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Creating cohort'
            : 'Create cohort'}
        </Button>
      </div>
    </form>
  );
}