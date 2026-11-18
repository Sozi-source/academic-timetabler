'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, Loader2, Send, X } from 'lucide-react';

import { submitCatOnBehalfAction } from './actions';

interface SubmitCatOnBehalfButtonProps {
  assessmentId: string;
  trainerLabel: string;
  missingCount: number;
}

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
      <span>{pending ? 'Submitting…' : 'Confirm & Submit'}</span>
    </button>
  );
}

/** HOD-only confirmation + submit for a trainer's saved-but-unsubmitted CAT marks. */
export function SubmitCatOnBehalfButton({ assessmentId, trainerLabel, missingCount }: SubmitCatOnBehalfButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 sm:min-h-9 h-auto w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
      >
        <Send className="size-3.5" aria-hidden="true" />
        <span>Submit CAT on behalf of trainer</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-cat-on-behalf-title"
        >
          <div
            style={{ maxWidth: '25rem' }}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Send className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="submit-cat-on-behalf-title" className="text-sm font-bold text-slate-900">
                    Submit CAT marks?
                  </h3>
                  <p className="text-xs text-slate-500">On behalf of {trainerLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close confirmation"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              {missingCount > 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <p>
                    <strong>{missingCount}</strong> student{missingCount === 1 ? '' : 's'} without a CAT mark will be recorded as <strong>AB (absent)</strong>.
                  </p>
                </div>
              ) : null}
              <p className="text-slate-600">
                This submission will be recorded under your name. You can unlock it later if corrections are needed.
              </p>
            </div>

            <form action={submitCatOnBehalfAction} className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <ConfirmSubmitButton />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
