'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

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
  updateAcademicPeriodAction,
} from './actions';
import {
  initialAcademicPeriodActionState,
  type AcademicPeriod,
} from './types';

interface EditAcademicPeriodFormProps {
  academicPeriod: AcademicPeriod;
  academicYears: AcademicYear[];
}

export function EditAcademicPeriodForm({
  academicPeriod,
  academicYears,
}: EditAcademicPeriodFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateAcademicPeriodAction,
      initialAcademicPeriodActionState,
    );

  const archived =
    academicPeriod.status === 'archived';

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
      action={formAction}
      className="space-y-4"
      noValidate
    >
      <input
        type="hidden"
        name="id"
        value={academicPeriod.id}
      />

      {archived ? (
        <FormStatusMessage
          status="warning"
          title="Archived record"
          message="This Academic Period is retained for historical purposes and cannot be edited."
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

      <FormField
        id="edit-academic-period-year"
        label="Academic Year"
        required
        error={academicYearError}
      >
        <Select
          id="edit-academic-period-year"
          name="academicYearId"
          required
          disabled={pending || archived}
          defaultValue={
            academicPeriod.academicYearId
          }
          hasError={Boolean(academicYearError)}
        >
          {academicYears.map((academicYear) => (
            <option
              key={academicYear.id}
              value={academicYear.id}
            >
              {academicYear.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="edit-academic-period-name"
        label="Period name"
        required
        error={nameError}
      >
        <Input
          id="edit-academic-period-name"
          name="name"
          required
          disabled={pending || archived}
          defaultValue={academicPeriod.name}
          hasError={Boolean(nameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="edit-academic-period-code"
          label="Period code"
          required
          error={codeError}
        >
          <Input
            id="edit-academic-period-code"
            name="code"
            required
            disabled={pending || archived}
            defaultValue={academicPeriod.code}
            hasError={Boolean(codeError)}
          />
        </FormField>

        <FormField
          id="edit-academic-period-sequence"
          label="Sequence"
          required
          error={sequenceError}
        >
          <Input
            id="edit-academic-period-sequence"
            name="sequenceNumber"
            type="number"
            min={1}
            max={20}
            required
            disabled={pending || archived}
            defaultValue={
              academicPeriod.sequenceNumber
            }
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
          startId="edit-academic-period-start"
          endId="edit-academic-period-end"
          startName="startsOn"
          endName="endsOn"
          startValue={academicPeriod.startsOn}
          endValue={academicPeriod.endsOn}
          startError={startsOnError}
          endError={endsOnError}
          disabled={pending || archived}
          required
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Teaching window
          </h3>
        </div>

        <DateRangeField
          startId="edit-teaching-start"
          endId="edit-teaching-end"
          startName="teachingStartsOn"
          endName="teachingEndsOn"
          startLabel="Teaching starts"
          endLabel="Teaching ends"
          startValue={
            academicPeriod.teachingStartsOn
          }
          endValue={
            academicPeriod.teachingEndsOn
          }
          startError={teachingStartsOnError}
          endError={teachingEndsOnError}
          disabled={pending || archived}
          required
        />
      </section>

      <FormField
        id="edit-academic-period-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="edit-academic-period-notes"
          name="notes"
          rows={5}
          maxLength={1000}
          disabled={pending || archived}
          defaultValue={
            academicPeriod.notes ?? ''
          }
          hasError={Boolean(notesError)}
        />
      </FormField>

      {!archived ? (
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
      ) : null}
    </form>
  );
}