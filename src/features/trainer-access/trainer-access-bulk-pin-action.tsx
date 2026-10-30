'use client';

import { Check, Copy, Download, KeyRound, LoaderCircle } from 'lucide-react';
import { useActionState, useState } from 'react';

import { generateTrainerAccessPinsBulkAction } from './actions';
import { initialTrainerAccessActionState } from './types';

interface BulkPinTrainerOption {
  trainerId: string;
  fullName: string;
  email: string;
}

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+@\-]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function TrainerAccessBulkPinAction({
  trainers,
}: {
  trainers: BulkPinTrainerOption[];
}) {
  const [state, formAction, pending] = useActionState(
    generateTrainerAccessPinsBulkAction,
    initialTrainerAccessActionState,
  );
  const [copiedTrainerId, setCopiedTrainerId] = useState<string | null>(null);

  async function copyPin(trainerId: string, pin: string) {
    await navigator.clipboard.writeText(pin);
    setCopiedTrainerId(trainerId);
    window.setTimeout(() => setCopiedTrainerId(null), 1800);
  }

  function downloadCsv() {
    if (!state.pins?.length) return;

    const portalUrl = `${window.location.origin}/external-trainer/login`;
    const rows = [
      ['Trainer', 'Email', 'Access PIN', 'Portal'],
      ...state.pins.map((grant) => [grant.fullName, grant.email, grant.pin, portalUrl]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `external-trainer-pins-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  }

  return (
    <div className="space-y-3">
      <form action={formAction}>
        {trainers.map((trainer) => (
          <input key={trainer.trainerId} type="hidden" name="trainerId" value={trainer.trainerId} />
        ))}
        <button
          type="submit"
          disabled={pending || trainers.length === 0}
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <KeyRound className="size-3.5" aria-hidden="true" />}
          {pending ? 'Generating PINs…' : 'Regenerate all PINs'}
        </button>
      </form>

      {state.message ? (
        <section
          aria-live="polite"
          className={state.status === 'error'
            ? 'rounded-xl border border-danger-border bg-danger-surface p-3 text-xs text-danger'
            : 'rounded-xl border border-border bg-surface-subtle p-3 text-xs text-text-secondary'}
        >
          <p>{state.message}</p>
          {state.pins?.length ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">One-time PIN list</p>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[11px] font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle"
                >
                  <Download className="size-3.5" aria-hidden="true" /> Download CSV
                </button>
              </div>
              <p className="text-[11px] leading-4 text-text-muted">Download and distribute these PINs now. They are shown only once and are not stored in the app. The CSV contains plain-text PINs; delete it after delivery.</p>
              <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-white">
                {state.pins.map((grant) => (
                  <div key={grant.trainerId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">{grant.fullName}</p>
                      <p className="truncate text-[10px] text-text-muted">{grant.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <code className="rounded-md bg-primary-subtle px-2 py-1 text-xs font-semibold tracking-wider text-primary">{grant.pin}</code>
                      <button
                        type="button"
                        onClick={() => void copyPin(grant.trainerId, grant.pin)}
                        aria-label={`Copy PIN for ${grant.fullName}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-text-muted transition hover:bg-surface-subtle hover:text-primary"
                      >
                        {copiedTrainerId === grant.trainerId
                          ? <Check className="size-3.5" aria-hidden="true" />
                          : <Copy className="size-3.5" aria-hidden="true" />}
                        {copiedTrainerId === grant.trainerId ? <span className="sr-only">Copied</span> : null}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {state.pinErrors?.length ? (
            <details className="mt-3 text-[11px]">
              <summary className="cursor-pointer font-semibold">{state.pinErrors.length} trainer{state.pinErrors.length === 1 ? '' : 's'} could not be processed</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.pinErrors.map((error) => <li key={`${error.trainerName}-${error.message}`}>{error.trainerName}: {error.message}</li>)}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
