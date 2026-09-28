'use client';

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useActionState,
  useEffect,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';

import {
  confirmMasterDataImportAction,
} from './actions';
import {
  initialMasterDataImportActionState,
  type MasterDataImportEntity,
} from './types';

export function MasterDataImportConfirmation({
  entity,
  batchId,
  validRows,
  invalidRows,
  duplicateRows,
  batchStatus,
}: {
  entity: MasterDataImportEntity;
  batchId: string;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  batchStatus: string;
}) {
  const router = useRouter();
  const label =
    entity === 'programmes'
      ? 'programmes'
      : 'cohorts';
  const [state, formAction, pending] =
    useActionState(
      confirmMasterDataImportAction,
      initialMasterDataImportActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);

  if (
    batchStatus === 'completed' ||
    batchStatus === 'completed_with_errors'
  ) {
    return (
      <section className="rounded-2xl border border-success-border bg-success-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 text-success"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold text-text-primary">
              Import completed
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Valid {label} were added. Skipped rows remain in the audit record.
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
          Confirm import
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Only Ready rows will be inserted. Invalid and duplicate rows will be skipped safely.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-success-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase text-success">Ready</p>
          <p className="mt-1 text-2xl font-semibold">{validRows}</p>
        </div>
        <div className="rounded-xl bg-danger-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase text-danger">Invalid</p>
          <p className="mt-1 text-2xl font-semibold">{invalidRows}</p>
        </div>
        <div className="rounded-xl bg-warning-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase text-warning">Duplicates</p>
          <p className="mt-1 text-2xl font-semibold">{duplicateRows}</p>
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
        <input type="hidden" name="entityType" value={entity} />
        <input type="hidden" name="batchId" value={batchId} />
        <Button
          type="submit"
          size="lg"
          disabled={
            pending ||
            batchStatus !== 'validated' ||
            validRows === 0
          }
          leadingIcon={
            pending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4" aria-hidden="true" />
            )
          }
        >
          {pending
            ? 'Importing'
            : `Import ${validRows} ${label}`}
        </Button>
      </form>
    </section>
  );
}
