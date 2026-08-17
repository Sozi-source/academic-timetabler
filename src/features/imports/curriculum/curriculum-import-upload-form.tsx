'use client';

import { BookOpenCheck, LoaderCircle, Upload } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { TemplateDownloadLink } from '@/features/imports/template-download-link';

import { stageCurriculumImportAction } from './actions';
import { initialCurriculumImportActionState } from './types';

export function CurriculumImportUploadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    stageCurriculumImportAction,
    initialCurriculumImportActionState,
  );

  useEffect(() => {
    if (state.status === 'success' && state.batchId) {
      router.push(`/students/unit-registration/curriculum/import/${state.batchId}`);
    }
  }, [router, state.batchId, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} />
      ) : null}

      {state.details?.length ? (
        <ul className="space-y-1 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">
          {state.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpenCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Use the Curriculum template</h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              Fixed Excel headers: Programme Code, Stage, Unit Code and Unit Name. CSV files are not accepted.
            </p>
            <TemplateDownloadLink entityType="curriculum" label="Download Curriculum template" className="mt-3" />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 className="font-semibold text-text-primary">Upload workbook</h2>
          <p className="mt-1 text-sm text-text-muted">
            Existing units are matched by Programme Code + Unit Code before anything new is created.
          </p>
        </div>

        <label htmlFor="curriculum-workbook" className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-subtle px-5 py-6 text-center transition hover:border-primary hover:bg-primary-subtle">
          <Upload className="size-7 text-primary" />
          <span className="mt-3 text-sm font-semibold text-text-primary">Select Curriculum workbook</span>
          <span className="mt-1 text-xs text-text-muted">Excel (.xlsx), max 50 MB</span>
          <input
            id="curriculum-workbook"
            name="workbook"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            disabled={pending}
            className="mt-4 block max-w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-semibold file:text-primary"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {pending ? 'Validating workbook' : 'Validate curriculum'}
        </Button>
      </div>
    </form>
  );
}
