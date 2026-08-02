'use client';

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  stageUnitOfferingImportAction,
} from './actions';
import {
  initialUnitOfferingImportActionState,
} from './types';

export function UnitOfferingImportUploadForm() {
  const router = useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    stageUnitOfferingImportAction,
    initialUnitOfferingImportActionState,
  );

  useEffect(() => {
    if (
      state.status === 'success' &&
      state.batchId
    ) {
      router.push(
        `/timetable/unit-offerings/import/${state.batchId}`,
      );
    }
  }, [
    router,
    state.batchId,
    state.status,
  ]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div>
        <h2 className="font-semibold text-text-primary">
          Upload completed workbook
        </h2>

        <p className="mt-1 text-sm leading-6 text-text-muted">
          The workbook will be validated against
          your registered Academic Periods,
          programmes, cohorts, units, trainers and
          rooms before anything is saved.
        </p>
      </div>

      {state.status === 'error' ? (
        <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4 text-sm text-danger">
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />

            <div>
              <p className="font-semibold">
                {state.message}
              </p>

              {state.details?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {state.details.map(
                    (detail) => (
                      <li key={detail}>
                        {detail}
                      </li>
                    ),
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {state.status === 'success' ? (
        <div className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-subtle p-4 text-sm text-success">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />

          <p>{state.message}</p>
        </div>
      ) : null}

      <label
        htmlFor="unit-offering-import-workbook"
        className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-subtle px-6 py-8 text-center transition hover:border-primary hover:bg-primary-subtle"
      >
        <Upload
          className="size-8 text-primary"
          aria-hidden="true"
        />

        <span className="mt-3 text-sm font-semibold text-text-primary">
          Select Units on Offer workbook
        </span>

        <span className="mt-1 text-xs text-text-muted">
          Excel .xlsx format, maximum 50 MB
        </span>

        <input
          id="unit-offering-import-workbook"
          name="workbook"
          type="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
        />
      </label>

      <div className="rounded-xl border border-border bg-surface-subtle p-4 text-sm leading-6 text-text-muted">
        <p className="font-semibold text-text-secondary">
          Validation rules
        </p>

        <p className="mt-1">
          Unit matching is restricted to the selected
          programme. Exact unit names are preferred,
          while codes are used only for confirmation
          or disambiguation. Unknown and ambiguous
          records are never guessed.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Upload
            className="size-4"
            aria-hidden="true"
          />
        )}

        {pending
          ? 'Validating workbook...'
          : 'Upload and validate'}
      </button>
    </form>
  );
}