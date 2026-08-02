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
import { DateRangeField } from '@/components/ui/date-range-field';
import {
  FormField,
  getFormFieldDescriptionId,
} from '@/components/ui/form-field';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  AcademicYear,
} from '@/features/academic-years/types';

import {
  createAcademicPeriodAction,
} from './actions';
import {
  initialAcademicPeriodActionState,
} from './types';

interface CreateAcademicPeriodFormProps {
  academicYears: AcademicYear[];
}

export function CreateAcademicPeriodForm({
  academicYears,
}: CreateAcademicPeriodFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createAcademicPeriodAction,
      initialAcademicPeriodActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  const academicYearError =
    state.fieldErrors?.academicYearId?.[0];

  const nameError =
    state.fieldErrors?.name?.[0];

  const codeError =
    state.fieldErrors?.code?.[0];

  const sequenceError =
    state.fieldErrors?.sequenceNumber?.[0];

  const startsOnError =
    state.fieldErrors?.startsOn?.[0];

  const endsOnError =
    state.fieldErrors?.endsOn?.[0];

  const teachingStartsOnError =
    state.fieldErrors?.teachingStartsOn?.[0];

  const teachingEndsOnError =
    state.fieldErrors?.teachingEndsOn?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

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

      <FormField
        id="academic-period-year"
        label="Academic Year"
        required
        error={academicYearError}
        description="Select the parent Academic Year for this period."
      >
        <Select
          id="academic-period-year"
          name="academicYearId"
          required
          disabled={pending}
          defaultValue=""
          hasError={Boolean(academicYearError)}
          aria-describedby={getFormFieldDescriptionId(
            'academic-period-year',
            {
              hasDescription: true,
              hasError: Boolean(
                academicYearError,
              ),
            },
          )}
        >
          <option value="" disabled>
            Select Academic Year
          </option>

          {academicYears.map((academicYear) => (
            <option
              key={academicYear.id}
              value={academicYear.id}
            >
              {academicYear.name}
              {academicYear.status === 'active'
                ? ' - Active'
                : ''}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="academic-period-name"
        label="Period name"
        required
        error={nameError}
        description="Example: January to April 2027."
      >
        <Input
          id="academic-period-name"
          name="name"
          required
          disabled={pending}
          hasError={Boolean(nameError)}
          aria-describedby={getFormFieldDescriptionId(
            'academic-period-name',
            {
              hasDescription: true,
              hasError: Boolean(nameError),
            },
          )}
          placeholder="January to April 2027"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="academic-period-code"
          label="Period code"
          required
          error={codeError}
          description="Use letters, numbers and hyphens."
        >
          <Input
            id="academic-period-code"
            name="code"
            required
            disabled={pending}
            hasError={Boolean(codeError)}
            aria-describedby={getFormFieldDescriptionId(
              'academic-period-code',
              {
                hasDescription: true,
                hasError: Boolean(codeError),
              },
            )}
            placeholder="JAN-APR"
          />
        </FormField>

        <FormField
          id="academic-period-sequence"
          label="Sequence"
          required
          error={sequenceError}
          description="Order within the Academic Year."
        >
          <Input
            id="academic-period-sequence"
            name="sequenceNumber"
            type="number"
            min={1}
            max={20}
            required
            disabled={pending}
            hasError={Boolean(sequenceError)}
            aria-describedby={getFormFieldDescriptionId(
              'academic-period-sequence',
              {
                hasDescription: true,
                hasError: Boolean(sequenceError),
              },
            )}
            placeholder="1"
          />
        </FormField>
      </div>

      <section className="space-y-3 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Academic Period dates
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            These dates define the complete period,
            including registration, teaching, assessment
            and closure activities.
          </p>
        </div>

        <DateRangeField
          startId="academic-period-start"
          endId="academic-period-end"
          startName="startsOn"
          endName="endsOn"
          startError={startsOnError}
          endError={endsOnError}
          disabled={pending}
          required
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Teaching dates
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Timetable sessions may only be scheduled
            within this teaching window.
          </p>
        </div>

        <DateRangeField
          startId="teaching-period-start"
          endId="teaching-period-end"
          startName="teachingStartsOn"
          endName="teachingEndsOn"
          startLabel="Teaching starts"
          endLabel="Teaching ends"
          startError={teachingStartsOnError}
          endError={teachingEndsOnError}
          disabled={pending}
          required
        />
      </section>

      <FormField
        id="academic-period-notes"
        label="Notes"
        optional
        error={notesError}
        description="Add calendar, examination or planning information."
      >
        <Textarea
          id="academic-period-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          hasError={Boolean(notesError)}
          aria-describedby={getFormFieldDescriptionId(
            'academic-period-notes',
            {
              hasDescription: true,
              hasError: Boolean(notesError),
            },
          )}
          placeholder="Add optional planning information."
        />
      </FormField>

      <div className="flex justify-end border-t border-border-soft pt-5">
        <Button
          type="submit"
          size="lg"
          disabled={
            pending ||
            academicYears.length === 0
          }
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
            ? 'Creating Academic Period'
            : 'Create Academic Period'}
        </Button>
      </div>
    </form>
  );
}