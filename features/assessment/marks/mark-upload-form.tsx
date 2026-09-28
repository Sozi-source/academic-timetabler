'use client';

import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { stageAssessmentMarksAction } from './actions';
import { initialMarkUploadActionState } from './types';

export function MarkUploadForm({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(stageAssessmentMarksAction, initialMarkUploadActionState);
  useEffect(() => {
    if (state.status === 'success' && state.batchId) router.push(`/assessment/marks/import/${state.batchId}`);
  }, [router, state.batchId, state.status]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}
      <label className="flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-subtle px-4 text-center hover:border-primary">
        <FileSpreadsheet className="size-5 text-primary" />
        <span><span className="block text-xs font-bold text-text-primary">Upload completed marks workbook</span><span className="mt-0.5 block text-[0.6875rem] text-text-muted">System-generated .xlsx only</span></span>
        <input name="workbook" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={pending} className="sr-only" />
      </label>
      <div className="flex justify-end"><Button type="submit" disabled={pending} leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}>{pending ? 'Validating' : 'Validate workbook'}</Button></div>
    </form>
  );
}
