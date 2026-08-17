'use client';

import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { confirmCurriculumImportAction } from './actions';
import { initialCurriculumImportActionState } from './types';

export function CurriculumImportConfirmation({
  batchId,
  validRows,
  invalidRows,
  duplicateRows,
  batchStatus,
}: {
  batchId: string;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  batchStatus: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    confirmCurriculumImportAction,
    initialCurriculumImportActionState,
  );

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [router, state.status]);

  if (batchStatus === 'completed' || batchStatus === 'completed_with_errors') {
    return (
      <section className="rounded-2xl border border-success-border bg-success-surface p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="size-5 text-success" />
          <div>
            <h2 className="font-semibold text-text-primary">Curriculum import completed</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Programme stages and curriculum-unit bindings are now authoritative.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const canImport = batchStatus === 'validated' && validRows > 0 && invalidRows === 0 && duplicateRows === 0;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">Confirm curriculum import</h2>
        <p className="mt-1 text-sm text-text-muted">
          Curriculum import is blocked until every row is clean. This prevents partial curriculum structures.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-success-surface px-4 py-3"><p className="text-xs font-bold text-success">READY</p><p className="mt-1 text-2xl font-semibold">{validRows}</p></div>
        <div className="rounded-xl bg-danger-surface px-4 py-3"><p className="text-xs font-bold text-danger">INVALID</p><p className="mt-1 text-2xl font-semibold">{invalidRows}</p></div>
        <div className="rounded-xl bg-warning-surface px-4 py-3"><p className="text-xs font-bold text-warning">DUPLICATES</p><p className="mt-1 text-2xl font-semibold">{duplicateRows}</p></div>
      </div>

      {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}

      <form action={formAction} className="flex justify-end">
        <input type="hidden" name="batchId" value={batchId} />
        <Button type="submit" size="lg" disabled={pending || !canImport}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {pending ? 'Committing curriculum' : `Import ${validRows} curriculum rows`}
        </Button>
      </form>
    </section>
  );
}
