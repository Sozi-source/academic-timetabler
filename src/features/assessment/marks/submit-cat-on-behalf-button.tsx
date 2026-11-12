'use client';

import type { FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Send } from 'lucide-react';

import { submitCatOnBehalfAction } from './actions';

interface SubmitCatOnBehalfButtonProps {
  assessmentId: string;
  trainerLabel: string;
  missingCount: number;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 sm:min-h-9 h-auto w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
      <span>{pending ? 'Submitting…' : 'Submit CAT on behalf of trainer'}</span>
    </button>
  );
}

/** HOD-only confirmation + submit for a trainer's saved-but-unsubmitted CAT marks. */
export function SubmitCatOnBehalfButton({ assessmentId, trainerLabel, missingCount }: SubmitCatOnBehalfButtonProps) {
  function confirmSubmit(event: FormEvent<HTMLFormElement>) {
    const absentNote = missingCount > 0
      ? `\n\n${missingCount} student(s) have no CAT mark and will be recorded as AB (absent).`
      : '';
    const confirmed = window.confirm(
      `Submit the saved CAT marks on behalf of ${trainerLabel}?${absentNote}\n\nThe submission will be recorded under your name. You can unlock it later for corrections.`,
    );
    if (!confirmed) event.preventDefault();
  }

  return (
    <form action={submitCatOnBehalfAction} onSubmit={confirmSubmit} className="w-full sm:w-auto">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <SubmitButton />
    </form>
  );
}
