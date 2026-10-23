'use client';

import { Check, Copy, KeyRound, LoaderCircle } from 'lucide-react';
import { useActionState, useState } from 'react';

import { generateTrainerAccessPinAction } from './actions';
import { initialTrainerAccessActionState } from './types';

export function TrainerAccessPinAction({ trainerId }: { trainerId: string }) {
  const [state, formAction, pending] = useActionState(
    generateTrainerAccessPinAction,
    initialTrainerAccessActionState,
  );
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    if (!state.pin) return;
    await navigator.clipboard.writeText(state.pin);
    setCopied(true);
  }

  return (
    <div className="space-y-1.5">
      <form action={formAction}>
        <input type="hidden" name="trainerId" value={trainerId} />
        <button type="submit" disabled={pending} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <KeyRound className="size-3.5 text-primary" aria-hidden="true" />}
          {pending ? 'Generating...' : 'Generate PIN'}
        </button>
      </form>
      {state.pin ? (
        <div className="max-w-52 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-[10px] font-semibold text-emerald-900">Share this PIN now</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="text-xs font-bold tracking-wider text-emerald-950">{state.pin}</code>
            <button type="button" onClick={() => void copyPin()} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 hover:underline">
              {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1 text-[9px] leading-3 text-emerald-800">Generating another PIN replaces this one.</p>
        </div>
      ) : state.message ? (
        <p className={state.status === 'error' ? 'max-w-52 text-[10px] leading-4 text-red-700' : 'max-w-52 text-[10px] leading-4 text-text-muted'}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
