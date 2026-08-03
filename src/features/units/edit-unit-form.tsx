'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';
import type {
  Programme,
} from '@/features/programmes/types';

import { updateUnitAction } from './actions';
import { UnitFormFields } from './unit-form-fields';
import {
  initialUnitActionState,
  type Unit,
} from './types';

interface EditUnitFormProps {
  unit: Unit;
  programmes: Programme[];
}

export function EditUnitForm({
  unit,
  programmes,
}: EditUnitFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateUnitAction,
      initialUnitActionState,
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
        value={unit.id}
      />

      {!unit.isActive ? (
        <FormStatusMessage
          status="warning"
          title="Inactive unit"
          message="This unit is retained for historical curriculum and timetable records but cannot receive new allocations until reactivated."
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

      <UnitFormFields
        state={state}
        programmes={programmes}
        unit={unit}
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