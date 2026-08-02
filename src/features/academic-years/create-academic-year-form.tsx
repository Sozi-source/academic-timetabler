'use client';

import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';

import {
  createAcademicYearAction,
} from './actions';
import {
  initialAcademicYearActionState,
} from './types';

export function CreateAcademicYearForm() {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createAcademicYearAction,
      initialAcademicYearActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

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
      ref={formRef}
      action={formAction}
      className="space-y-5"
      noValidate
    >
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
          disabled={pending}
          placeholder="Example: 2026 Academic Year"
          aria-invalid={Boolean(nameError)}
          aria-describedby={
            nameError
              ? 'academic-year-name-error'
              : 'academic-year-name-help'
          }
          className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-subtle hover:border-[#b8c7c4] focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger"
        />

        {nameError ? (
          <p
            id="academic-year-name-error"
            className="text-xs font-medium text-danger"
          >
            {nameError}
          </p>
        ) : (
          <p
            id="academic-year-name-help"
            className="text-xs text-text-muted"
          >
            Use a clear institutional name such as
            “2026 Academic Year”.
          </p>
        )}
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
            disabled={pending}
            aria-invalid={Boolean(startsOnError)}
            aria-describedby={
              startsOnError
                ? 'academic-year-start-error'
                : undefined
            }
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition hover:border-[#b8c7c4] focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger"
          />

          {startsOnError ? (
            <p
              id="academic-year-start-error"
              className="text-xs font-medium text-danger"
            >
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
            disabled={pending}
            aria-invalid={Boolean(endsOnError)}
            aria-describedby={
              endsOnError
                ? 'academic-year-end-error'
                : undefined
            }
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition hover:border-[#b8c7c4] focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger"
          />

          {endsOnError ? (
            <p
              id="academic-year-end-error"
              className="text-xs font-medium text-danger"
            >
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
          <span className="ml-1 font-normal text-text-muted">
            Optional
          </span>
        </label>

        <textarea
          id="academic-year-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          aria-invalid={Boolean(notesError)}
          aria-describedby={
            notesError
              ? 'academic-year-notes-error'
              : undefined
          }
          placeholder="Add relevant planning information."
          className="w-full resize-y rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-sm leading-6 text-text-primary outline-none transition placeholder:text-text-subtle hover:border-[#b8c7c4] focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger"
        />

        {notesError ? (
          <p
            id="academic-year-notes-error"
            className="text-xs font-medium text-danger"
          >
            {notesError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-border-soft pt-5">
        <Button
          type="submit"
          variant="primary"
          size="lg"
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
            ? 'Creating Academic Year'
            : 'Create Academic Year'}
        </Button>
      </div>
    </form>
  );
}