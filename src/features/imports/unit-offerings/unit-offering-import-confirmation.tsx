'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  useActionState,
} from 'react';

import {
  confirmUnitOfferingImportAction,
} from './actions';
import {
  initialUnitOfferingImportActionState,
  type UnitOfferingImportBatch,
  type UnitOfferingImportStagedRow,
} from './types';

interface UnitOfferingImportConfirmationProps {
  batch:
    UnitOfferingImportBatch;

  rows:
    UnitOfferingImportStagedRow[];
}

export function UnitOfferingImportConfirmation({
  batch,
  rows,
}: UnitOfferingImportConfirmationProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    confirmUnitOfferingImportAction,
    initialUnitOfferingImportActionState,
  );

  const validRows =
    rows.filter(
      (row) =>
        row.status === 'valid',
    );

  const reviewedRows =
    validRows.filter((row) => {
      const normalized =
        row.normalizedData as {
          importOperation?: string;
        };

      return (
        normalized.importOperation ===
        'preserve-reviewed'
      );
    });

  const masterUnitsToCreate =
    validRows.filter((row) => {
      const normalized =
        row.normalizedData as {
          masterUnitOperation?: string;
        };

      return (
        normalized.masterUnitOperation ===
          'create' ||
        normalized.masterUnitOperation ===
          'reactivate'
      );
    }).length;

  const batchAlreadyCompleted =
    batch.status === 'completed' ||
    batch.status ===
      'completed_with_errors';

  const canConfirm =
    batch.status === 'validated' &&
    validRows.length > 0 &&
    !pending;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Database
            className="size-5"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-text-primary">
            Import
          </h2>

          <p className="mt-1 text-sm leading-6 text-text-muted">
            Only valid staged rows will modify the
            database. Invalid and duplicate rows
            remain in the import audit history.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Eligible
              </p>

              <p className="mt-1 text-xl font-bold text-text-primary">
                {validRows.length}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Excluded
              </p>

              <p className="mt-1 text-xl font-bold text-text-primary">
                {batch.invalidRows +
                  batch.duplicateRows}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Reviewed
              </p>

              <p className="mt-1 text-xl font-bold text-text-primary">
                {reviewedRows.length}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Master Units
              </p>

              <p className="mt-1 text-xl font-bold text-text-primary">
                {masterUnitsToCreate}
              </p>
            </div>
          </div>

          {reviewedRows.length > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-subtle p-4 text-sm text-warning">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />

              <p>
                {reviewedRows.length}{' '}
                manually reviewed decision
                {reviewedRows.length === 1
                  ? ''
                  : 's'}{' '}
                will be preserved.
              </p>
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-subtle p-4 text-sm text-danger">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />

              <p>{state.message}</p>
            </div>
          ) : null}

          {state.status === 'success' ? (
            <div className="mt-4 rounded-xl border border-success/20 bg-success-subtle p-4 text-sm text-success">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />

                <div>
                  <p className="font-semibold">
                    {state.message}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                    <span>
                      Inserted:{' '}
                      <strong>
                        {state.importedCount ?? 0}
                      </strong>
                    </span>

                    <span>
                      Updated:{' '}
                      <strong>
                        {state.updatedCount ?? 0}
                      </strong>
                    </span>

                    <span>
                      Skipped:{' '}
                      <strong>
                        {state.skippedCount ?? 0}
                      </strong>
                    </span>

                    <span>
                      Failed:{' '}
                      <strong>
                        {state.failedCount ?? 0}
                      </strong>
                    </span>

                    <span>
                      Shared classes:{' '}
                      <strong>
                        {state.sharedOfferingCount ??
                          0}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {validRows.length === 0 &&
          !batchAlreadyCompleted ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-subtle p-4 text-sm text-danger">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />

              <p>
                This batch has no valid rows and
                cannot be imported.
              </p>
            </div>
          ) : null}

          {batchAlreadyCompleted ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success-subtle px-4 py-3 text-sm font-semibold text-success">
              <CheckCircle2
                className="size-4"
                aria-hidden="true"
              />

              This batch has already been confirmed.
            </div>
          ) : (
            <form
              action={formAction}
              className="mt-5"
            >
              <input
                type="hidden"
                name="batchId"
                value={batch.id}
              />

              <button
                type="submit"
                disabled={!canConfirm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Database
                    className="size-4"
                    aria-hidden="true"
                  />
                )}

                {pending
                  ? 'Importing...'
                  : 'Import'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}