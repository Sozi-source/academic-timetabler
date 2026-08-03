'use client';

import {
  LoaderCircle,
  UsersRound,
} from 'lucide-react';
import {
  useActionState,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import type { Programme } from '@/features/programmes/types';

import { createCohortAction } from './actions';
import { CohortFormFields } from './cohort-form-fields';
import {
  initialCohortActionState,
  type CohortActionState,
} from './types';

interface CreateCohortFormProps {
  programmes: Programme[];
  academicPeriods: AcademicPeriod[];
}

export function CreateCohortForm({
  programmes,
  academicPeriods,
}: CreateCohortFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [formVersion, setFormVersion] =
    useState(0);

  async function createAndResetCohort(
    previousState: CohortActionState,
    formData: FormData,
  ): Promise<CohortActionState> {
    const result =
      await createCohortAction(
        previousState,
        formData,
      );

    if (result.status === 'success') {
      formRef.current?.reset();

      setFormVersion(
        (value) => value + 1,
      );
    }

    return result;
  }

  const [state, formAction, pending] =
    useActionState(
      createAndResetCohort,
      initialCohortActionState,
    );

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

      <CohortFormFields
        key={formVersion}
        state={state}
        programmes={programmes}
        academicPeriods={academicPeriods}
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
              <UsersRound
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