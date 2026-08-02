'use client';

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  Button,
} from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';

import {
  confirmUnitImportAction,
} from './actions';
import {
  initialUnitImportActionState,
} from './types';

interface UnitImportConfirmationProps {
  batchId: string;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  batchStatus: string;
}

export function UnitImportConfirmation({
  batchId,
  validRows,
  invalidRows,
  duplicateRows,
  batchStatus,
}: UnitImportConfirmationProps) {
  const router = useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    confirmUnitImportAction,
    initialUnitImportActionState,
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [
    router,
    state.status,
  ]);

  const canImport =
    batchStatus === 'validated' &&
    validRows > 0;

  if (
    batchStatus === 'completed' ||
    batchStatus ===
      'completed_with_errors'
  ) {
    return (
      <section className="rounded-2xl border border-success-border bg-success-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-success"
            aria-hidden="true"
          />

          <div>
            <h2 className="font-semibold text-text-primary">
              Units import completed
            </h2>

            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Valid curriculum units have been inserted
              and the import audit batch is complete.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">
          Confirm Units import
        </h2>

        <p className="mt-1 text-sm leading-6 text-text-muted">
          Only rows marked Ready will be inserted.
          Invalid and duplicate rows remain in the
          audit history and will be skipped.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-success-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">
            Ready
          </p>

          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {validRows}
          </p>
        </div>

        <div className="rounded-xl bg-danger-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger">
            Invalid
          </p>

          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {invalidRows}
          </p>
        </div>

        <div className="rounded-xl bg-warning-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            Duplicates
          </p>

          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {duplicateRows}
          </p>
        </div>
      </div>

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

      <form
        action={formAction}
        className="flex justify-end"
      >
        <input
          type="hidden"
          name="batchId"
          value={batchId}
        />

        <Button
          type="submit"
          size="lg"
          disabled={
            pending ||
            !canImport
          }
          leadingIcon={
            pending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Importing units'
            : `Import ${validRows} unit${
                validRows === 1
                  ? ''
                  : 's'
              }`}
        </Button>
      </form>

      {!canImport ? (
        <p className="text-right text-xs text-text-muted">
          There are no valid staged rows available
          for import.
        </p>
      ) : null}
    </section>
  );
}