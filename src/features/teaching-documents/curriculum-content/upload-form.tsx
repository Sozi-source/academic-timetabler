'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { initialCurriculumContentImportState } from './types';
import { stageCurriculumContentImportAction } from './actions';

export function CurriculumContentUploadForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(stageCurriculumContentImportAction, initialCurriculumContentImportState);
  useEffect(() => {
    if (state.status === 'success' && state.batchId) router.push(`/teaching-documents/curriculum/import/${state.batchId}`);
  }, [router,state.status,state.batchId]);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}
      {state.details?.length ? (
        <div className="rounded-xl border border-danger-border bg-danger-surface p-4 text-sm text-danger">
          {state.details.map((item) => <div key={item}>{item}</div>)}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text-primary">Curriculum content template</h2>
        <p className="mt-1 text-sm text-text-muted">Download the current system template, complete it, then upload the same .xlsx structure.</p>
        <a href="/api/teaching-documents/curriculum/import-template" className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
          <Download className="size-4" /> Download Excel template
        </a>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text-primary">Upload completed workbook</h2>
        <p className="mt-1 text-sm text-text-muted">The system validates unit codes, shared curriculum families and all 14 teaching weeks before import.</p>
        <input name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} className="mt-4 block w-full text-sm text-text-muted" />
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {pending ? 'Validating' : 'Validate workbook'}
        </Button>
      </div>
    </form>
  );
}
