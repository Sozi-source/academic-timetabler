'use client';

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';

import { updateAcademicYearAction } from './actions';
import {
  initialAcademicYearActionState,
  type AcademicYear,
} from './types';

interface EditAcademicYearFormProps {
  academicYear: AcademicYear;
}

export function EditAcademicYearForm({
  academicYear,
}: EditAcademicYearFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateAcademicYearAction,
      initialAcademicYearActionState,
    );

  const nameError =
    state.fieldErrors?.name?.[0];

  const startsOnError =
    state.fieldErrors?.startsOn?.[0];

  const endsOnError =
    state.fieldErrors?.endsOn?.[0];

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
        value={academicYear.id}
      />

      {state.message ? (
        <div
          role={
            state.status === 'error'
              ? 'alert'
              : 'status'
          }
          className={
            state.status === 'error'
              ? 'flex items-start gap-3 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger'
              : 'flex items-start gap-3 rounded-xl border border-success-border bg-success-surface px-4 py-3 text-sm text-success'
          }
        >
          {state.status === 'error' ? (
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}

          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="academic-year-name"
          className="block text-sm font-medium text-text-primary"
        >
          Academic year name
        </label>

        <input
          id="academic-year-name"
          name="name"
          type="text"
          required
          defaultValue={academicYear.name}
          disabled={pending}
          aria-invalid={Boolean(nameError)}
          className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:bg-surface-muted aria-invalid:border-danger"
        />

        {nameError ? (
          <p className="text-xs font-medium text-danger">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="academic-year-start"
            className="block text-sm font-medium text-text-primary"
          >
            Start date
          </label>

          <input
            id="academic-year-start"
            name="startsOn"
            type="date"
            required
            defaultValue={academicYear.startsOn}
            disabled={pending}
            aria-invalid={Boolean(startsOnError)}
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:bg-surface-muted aria-invalid:border-danger"
          />

          {startsOnError ? (
            <p className="text-xs font-medium text-danger">
              {startsOnError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="academic-year-end"
            className="block text-sm font-medium text-text-primary"
          >
            End date
          </label>

          <input
            id="academic-year-end"
            name="endsOn"
            type="date"
            required
            defaultValue={academicYear.endsOn}
            disabled={pending}
            aria-invalid={Boolean(endsOnError)}
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:bg-surface-muted aria-invalid:border-danger"
          />

          {endsOnError ? (
            <p className="text-xs font-medium text-danger">
              {endsOnError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="academic-year-notes"
          className="block text-sm font-medium text-text-primary"
        >
          Notes
        </label>

        <textarea
          id="academic-year-notes"
          name="notes"
          rows={5}
          maxLength={1000}
          defaultValue={academicYear.notes ?? ''}
          disabled={pending}
          aria-invalid={Boolean(notesError)}
          className="w-full resize-y rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:bg-surface-muted aria-invalid:border-danger"
        />

        {notesError ? (
          <p className="text-xs font-medium text-danger">
            {notesError}
          </p>
        ) : null}
      </div>

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