'use client';

import {
  Clock3,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
} from '@/components/ui/form-field';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { createTimeSlotAction } from './actions';
import {
  initialTimeSlotActionState,
  timeSlotTypeOptions,
} from './types';

interface CreateTimeSlotFormProps {
  academicPeriodId: string;
}

export function CreateTimeSlotForm({
  academicPeriodId,
}: CreateTimeSlotFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createTimeSlotAction,
      initialTimeSlotActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  const nameError =
    state.fieldErrors?.name?.[0];

  const codeError =
    state.fieldErrors?.code?.[0];

  const slotTypeError =
    state.fieldErrors?.slotType?.[0];

  const startsAtError =
    state.fieldErrors?.startsAt?.[0];

  const endsAtError =
    state.fieldErrors?.endsAt?.[0];

  const sequenceError =
    state.fieldErrors?.sequenceNumber?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
    >
      <input
        type="hidden"
        name="academicPeriodId"
        value={academicPeriodId}
      />

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

      <FormField
        id="time-slot-name"
        label="Slot name"
        required
        error={nameError}
      >
        <Input
          id="time-slot-name"
          name="name"
          required
          disabled={pending}
          hasError={Boolean(nameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="time-slot-code"
          label="Code"
          required
          error={codeError}
        >
          <Input
            id="time-slot-code"
            name="code"
            required
            disabled={pending}
            hasError={Boolean(codeError)}
          />
        </FormField>

        <FormField
          id="time-slot-type"
          label="Slot type"
          required
          error={slotTypeError}
        >
          <Select
            id="time-slot-type"
            name="slotType"
            required
            disabled={pending}
            defaultValue="teaching"
            hasError={Boolean(slotTypeError)}
          >
            {timeSlotTypeOptions.map((type) => (
              <option
                key={type.value}
                value={type.value}
              >
                {type.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="time-slot-start"
          label="Start time"
          required
          error={startsAtError}
        >
          <Input
            id="time-slot-start"
            name="startsAt"
            type="time"
            required
            disabled={pending}
            hasError={Boolean(startsAtError)}
          />
        </FormField>

        <FormField
          id="time-slot-end"
          label="End time"
          required
          error={endsAtError}
        >
          <Input
            id="time-slot-end"
            name="endsAt"
            type="time"
            required
            disabled={pending}
            hasError={Boolean(endsAtError)}
          />
        </FormField>
      </div>

      <FormField
        id="time-slot-sequence"
        label="Display order"
        required
        error={sequenceError}
      >
        <Input
          id="time-slot-sequence"
          name="sequenceNumber"
          type="number"
          min={1}
          max={50}
          required
          disabled={pending}
          hasError={Boolean(sequenceError)}
        />
      </FormField>

      <FormField
        id="time-slot-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="time-slot-notes"
          name="notes"
          rows={3}
          maxLength={500}
          disabled={pending}
          hasError={Boolean(notesError)}
        />
      </FormField>

      <div className="flex justify-end border-t border-border-soft pt-4">
        <Button
          type="submit"
          disabled={pending}
          leadingIcon={
            pending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Clock3
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Creating Time Slot'
            : 'Create Time Slot'}
        </Button>
      </div>
    </form>
  );
}