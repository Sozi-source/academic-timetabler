'use client';

import {
  BookPlus,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';
import type {
  Programme,
} from '@/features/programmes/types';

import { createUnitAction } from './actions';
import { UnitFormFields } from './unit-form-fields';
import {
  initialUnitActionState,
} from './types';

interface CreateUnitFormProps {
  programmes: Programme[];
}

export function CreateUnitForm({
  programmes,
}: CreateUnitFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createUnitAction,
      initialUnitActionState,
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

      <UnitFormFields
        state={state}
        programmes={programmes}
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
              <BookPlus
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