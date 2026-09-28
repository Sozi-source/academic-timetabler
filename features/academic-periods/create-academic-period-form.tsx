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

      <FormField
        id="academic-period-year"
        label="Academic Year"
        required
        error={academicYearError}
      >
        <Select
          id="academic-period-year"
          name="academicYearId"
          required
          disabled={pending}
          defaultValue=""
          hasError={Boolean(academicYearError)}
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
      >
        <Input
          id="academic-period-name"
          name="name"
          required
          disabled={pending}
          hasError={Boolean(nameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="academic-period-code"
          label="Period code"
          required
          error={codeError}
        >
          <Input
            id="academic-period-code"
            name="code"
            required
            disabled={pending}
            hasError={Boolean(codeError)}
          />
        </FormField>

        <FormField
          id="academic-period-sequence"
          label="Sequence"
          required
          error={sequenceError}
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
          />
        </FormField>
      </div>

      <section className="space-y-3 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Academic Period dates
          </h3>
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
      >
        <Textarea
          id="academic-period-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          hasError={Boolean(notesError)}
        />
      </FormField>

      <div className="flex justify-end border-t border-border-soft pt-4">
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
            ? 'Saving'
            : 'Save'}
        </Button>
      </div>
    </form>
  );
}