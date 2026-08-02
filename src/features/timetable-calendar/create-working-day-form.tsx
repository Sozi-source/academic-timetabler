'use client';

import {
  CalendarPlus,
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
  getFormFieldDescriptionId,
} from '@/components/ui/form-field';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { createWorkingDayAction } from './actions';
import {
  initialWorkingDayActionState,
  weekdayOptions,
} from './types';

interface CreateWorkingDayFormProps {
  academicPeriodId: string;
  configuredDays: string[];
}

export function CreateWorkingDayForm({
  academicPeriodId,
  configuredDays,
}: CreateWorkingDayFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createWorkingDayAction,
      initialWorkingDayActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  const availableDays = weekdayOptions.filter(
    (day) => !configuredDays.includes(day.value),
  );

  const dayError =
    state.fieldErrors?.dayOfWeek?.[0];

  const sequenceError =
    state.fieldErrors?.sequenceNumber?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5"
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

      {availableDays.length === 0 ? (
        <FormStatusMessage
          status="info"
          message="All seven days have already been configured for this Academic Period."
        />
      ) : (
        <>
          <FormField
            id="working-day"
            label="Day of the week"
            required
            error={dayError}
          >
            <Select
              id="working-day"
              name="dayOfWeek"
              required
              disabled={pending}
              defaultValue=""
              hasError={Boolean(dayError)}
            >
              <option
                value=""
                disabled
              >
                Select day
              </option>

              {availableDays.map((day) => (
                <option
                  key={day.value}
                  value={day.value}
                >
                  {day.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="working-day-sequence"
            label="Display order"
            required
            error={sequenceError}
            description="Use 1 for Monday, 2 for Tuesday and so on."
          >
            <Input
              id="working-day-sequence"
              name="sequenceNumber"
              type="number"
              min={1}
              max={7}
              required
              disabled={pending}
              hasError={Boolean(sequenceError)}
              aria-describedby={getFormFieldDescriptionId(
                'working-day-sequence',
                {
                  hasDescription: true,
                  hasError: Boolean(sequenceError),
                },
              )}
              placeholder="6"
            />
          </FormField>

          <FormField
            id="working-day-notes"
            label="Notes"
            optional
            error={notesError}
          >
            <Textarea
              id="working-day-notes"
              name="notes"
              rows={3}
              maxLength={500}
              disabled={pending}
              hasError={Boolean(notesError)}
              placeholder="Optional scheduling information."
            />
          </FormField>

          <div className="flex justify-end border-t border-border-soft pt-5">
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
                  <CalendarPlus
                    className="size-4"
                    aria-hidden="true"
                  />
                )
              }
            >
              {pending
                ? 'Adding Working Day'
                : 'Add Working Day'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}