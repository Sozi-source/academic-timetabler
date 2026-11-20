'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, GraduationCap, Loader2, Send, X } from 'lucide-react';

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
      className="inline-flex min-h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-[#0b7a64] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#096452] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-cat-on-behalf-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{ maxWidth: '24rem' }}
            className="relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close confirmation"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="px-5 pt-6 pb-5 text-center sm:px-6">
              <div className="mx-auto flex justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#e6f6f2] text-[#0b4f4a] ring-1 ring-[#bfe8de]">
                  <GraduationCap className="size-6" aria-hidden="true" />
                </span>
              </div>

              <h3 id="submit-cat-on-behalf-title" className="mt-3 text-lg font-extrabold tracking-tight text-[#0b2545]">
                Submit CAT Marks?
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                On behalf of {trainerLabel}
              </p>

              {missingCount > 0 ? (
                <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-left text-xs text-amber-950">
                  <span className="flex shrink-0 items-center border-r border-amber-200/90 pr-3">
                    <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
                  </span>
                  <p className="leading-snug">
                    <strong>{missingCount}</strong> student{missingCount === 1 ? '' : 's'} without a CAT mark will be recorded as{' '}
                    <strong>AB (absent)</strong>.
                  </p>
                </div>
              ) : null}


              <form action={submitCatOnBehalfAction} className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-2.5">
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-9 w-full sm:w-auto sm:min-w-[6.5rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-[#0b2545] transition hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <ConfirmSubmitButton />
              </form>
            </div>

            <div className="h-1 w-full bg-gradient-to-r from-emerald-400/70 via-[#0b7a64] to-teal-400/70" aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </>
  );
}
