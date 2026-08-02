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
  FormField,
  getFormFieldDescriptionId,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

      <FormField
        id="academic-year-name"
        label="Academic year name"
        required
        error={nameError}
        description="Use a clear institutional name such as 2026 Academic Year."
      >
        <Input
          id="academic-year-name"
          name="name"
          type="text"
          required
          disabled={pending}
          hasError={Boolean(nameError)}
          aria-describedby={getFormFieldDescriptionId(
            'academic-year-name',
            {
              hasDescription: true,
              hasError: Boolean(nameError),
            },
          )}
          placeholder="Example: 2026 Academic Year"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="academic-year-start"
          label="Start date"
          required
          error={startsOnError}
        >
          <Input
            id="academic-year-start"
            name="startsOn"
            type="date"
            required
            disabled={pending}
            hasError={Boolean(startsOnError)}
            aria-describedby={getFormFieldDescriptionId(
              'academic-year-start',
              {
                hasError: Boolean(startsOnError),
              },
            )}
          />
        </FormField>

        <FormField
          id="academic-year-end"
          label="End date"
          required
          error={endsOnError}
        >
          <Input
            id="academic-year-end"
            name="endsOn"
            type="date"
            required
            disabled={pending}
            hasError={Boolean(endsOnError)}
            aria-describedby={getFormFieldDescriptionId(
              'academic-year-end',
              {
                hasError: Boolean(endsOnError),
              },
            )}
          />
        </FormField>
      </div>

      <FormField
        id="academic-year-notes"
        label="Notes"
        optional
        error={notesError}
        description="Add relevant institutional planning information."
      >
        <Textarea
          id="academic-year-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          hasError={Boolean(notesError)}
          aria-describedby={getFormFieldDescriptionId(
            'academic-year-notes',
            {
              hasDescription: true,
              hasError: Boolean(notesError),
            },
          )}
          placeholder="Add relevant planning information."
        />
      </FormField>

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