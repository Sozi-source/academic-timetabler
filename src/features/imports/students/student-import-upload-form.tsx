'use client';
import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { TemplateDownloadLink } from '@/features/imports/template-download-link';
import { stageStudentImportAction } from './actions';
import { initialStudentImportActionState } from './types';

export function StudentImportUploadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(stageStudentImportAction, initialStudentImportActionState);
  useEffect(() => { if (state.status === 'success' && state.batchId) router.push(`/students/registry/import/${state.batchId}`); }, [router, state.batchId, state.status]);
  return <form action={formAction} className="space-y-4">
    {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}
    {state.details?.length ? <ul className="space-y-1 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">{state.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}
    <section className="rounded-xl border border-border bg-surface p-4"><div className="flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><FileSpreadsheet className="size-4.5" /></div><div><h2 className="text-sm font-semibold text-text-primary">Student workbook</h2><p className="mt-1 text-xs text-text-muted">Admission Number and Full Name are required.</p><TemplateDownloadLink entityType="students" label="Download Students template" className="mt-3" /></div></div></section>
    <section className="rounded-xl border border-border bg-surface p-4"><label htmlFor="student-import-workbook" className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-subtle px-5 py-5 text-center hover:border-primary"><Upload className="size-6 text-primary"/><span className="mt-2 text-sm font-semibold text-text-primary">Select workbook</span><span className="mt-1 text-xs text-text-muted">Excel .xlsx format</span><input id="student-import-workbook" name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} className="mt-3 block max-w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-semibold file:text-primary"/></label></section>
    <div className="flex justify-end"><Button type="submit" disabled={pending} leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin"/> : <Upload className="size-4"/>}>{pending ? 'Validating' : 'Validate workbook'}</Button></div>
  </form>;
}
