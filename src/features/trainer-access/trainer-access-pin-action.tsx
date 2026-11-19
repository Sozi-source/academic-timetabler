'use client';

import { AlertCircle, Check, Copy, ExternalLink, KeyRound, LoaderCircle } from 'lucide-react';
import { useActionState, useState } from 'react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { generateTrainerAccessPinAction } from './actions';
import {
  initialTrainerAccessActionState,
  type TrainerAccessActionState,
} from './types';

interface TrainerAccessPinActionProps {
  trainerId: string;
  trainerName?: string;
  trainerEmail?: string | null;
}

export function TrainerAccessPinAction({
  trainerId,
  trainerName,
  trainerEmail,
}: TrainerAccessPinActionProps) {
  const [state, formAction, pending] = useActionState(
    generateTrainerAccessPinAction,
    initialTrainerAccessActionState,
  );
  const [dismissedState, setDismissedState] =
    useState<TrainerAccessActionState | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const hasResult = Boolean(
    state.pin || (state.status === 'error' && state.message),
  );
  const dialogOpen = hasResult && dismissedState !== state;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setDismissedState(state);
      setCopiedPin(false);
      setCopiedLink(false);
    }
  }

  async function copyPin() {
    if (!state.pin) return;
    await navigator.clipboard.writeText(state.pin);
    setCopiedPin(true);
    window.setTimeout(() => setCopiedPin(false), 1800);
  }

  async function copyPortalLink() {
    const portalUrl = `${window.location.origin}/external-trainer/login`;
    await navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  }

  return (
    <>
      <form action={formAction} className="shrink-0">
        <input type="hidden" name="trainerId" value={trainerId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 sm:min-h-8 h-auto min-w-[7.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border-strong bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span>{pending ? 'Generating…' : 'Generate PIN'}</span>
        </button>
      </form>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          {state.pin ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="size-4 text-primary" aria-hidden="true" />
                  External Trainer Access PIN
                </DialogTitle>
                <DialogDescription>
                  {trainerName
                    ? `One-time PIN generated for ${trainerName}${trainerEmail ? ` (${trainerEmail})` : ''}.`
                    : 'Share this one-time PIN with the trainer now.'}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-900">
                    One-time 8-digit PIN
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <code className="font-mono text-2xl font-bold tracking-[0.2em] tabular-nums text-emerald-950">
                      {state.pin}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyPin()}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-2xs transition hover:bg-emerald-100/70"
                    >
                      {copiedPin ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                      {copiedPin ? 'Copied' : 'Copy PIN'}
                    </button>
                  </div>
                  <p className="mt-2.5 text-xs leading-5 text-emerald-800">
                    This PIN is shown only once and cannot be retrieved later. Generating a new PIN immediately replaces this one.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-soft bg-surface-subtle px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">External trainer sign-in</p>
                    <p className="truncate text-text-muted">/external-trainer/login</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyPortalLink()}
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                  >
                    {copiedLink ? (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    )}
                    {copiedLink ? 'Link copied' : 'Copy link'}
                  </button>
                </div>
              </DialogBody>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover"
                >
                  Done
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base text-danger">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  Could not generate PIN
                </DialogTitle>
                {trainerName ? (
                  <DialogDescription>
                    {trainerName}
                    {trainerEmail ? ` · ${trainerEmail}` : ''}
                  </DialogDescription>
                ) : null}
              </DialogHeader>

              <DialogBody>
                <div className="rounded-xl border border-danger-border bg-danger-surface p-3.5 text-sm leading-6 text-danger">
                  {state.message}
                </div>
              </DialogBody>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface-subtle"
                >
                  Close
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
