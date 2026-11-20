'use client';

import { Check, Copy, Download, KeyRound, LoaderCircle, X } from 'lucide-react';
import { useActionState, useState } from 'react';

import { generateTrainerAccessPinsBulkAction } from './actions';
import {
  initialTrainerAccessActionState,
  type TrainerAccessActionState,
} from './types';

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
  const [dismissedState, setDismissedState] =
    useState<TrainerAccessActionState | null>(null);
  const [copiedTrainerId, setCopiedTrainerId] = useState<string | null>(null);

  const showResults = Boolean(state.message && dismissedState !== state);

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
    <div className="space-y-4 border-b border-border bg-surface-subtle/40 px-4 py-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-text-primary lg:text-sm">
            Bulk PIN generation
          </h3>
        </div>

        <form action={formAction} className="w-full shrink-0 sm:w-auto">
          {trainers.map((trainer) => (
            <input key={trainer.trainerId} type="hidden" name="trainerId" value={trainer.trainerId} />
          ))}
          <button
            type="submit"
            disabled={pending || trainers.length === 0}
            className="inline-flex min-h-11 sm:min-h-9 h-auto w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
          >
            {pending ? (
              <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{pending ? 'Generating PINs…' : 'Regenerate all PINs'}</span>
          </button>
        </form>
      </div>

      {showResults ? (
        <section
          aria-live="polite"
          className={
            state.status === 'error'
              ? 'rounded-xl border border-danger-border bg-danger-surface p-4 text-xs text-danger'
              : 'rounded-xl border border-border bg-white p-4 text-xs text-text-secondary shadow-2xs'
          }
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium leading-5">{state.message}</p>
            <button
              type="button"
              onClick={() => setDismissedState(state)}
              aria-label="Dismiss PIN list"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {state.pins?.length ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
                <div>
                  <p className="font-semibold text-text-primary">
                    One-time PIN list ({state.pins.length})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex min-h-10 sm:min-h-9 h-auto w-full sm:w-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border-strong bg-white px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-text-primary shadow-2xs transition hover:bg-surface-subtle"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download CSV
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-border-soft bg-surface-subtle/40 p-2.5">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {state.pins.map((grant) => (
                    <div
                      key={grant.trainerId}
                      className="flex items-center justify-between gap-2.5 rounded-lg border border-border-soft bg-white px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text-primary">
                          {grant.fullName}
                        </p>
                        <p className="truncate text-[11px] text-text-muted">
                          {grant.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <code className="rounded-md bg-primary-subtle px-2 py-1 font-mono text-xs font-semibold tracking-wider tabular-nums text-primary">
                          {grant.pin}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyPin(grant.trainerId, grant.pin)}
                          aria-label={`Copy PIN for ${grant.fullName}`}
                          className="inline-flex min-h-9 min-w-9 sm:min-h-8 sm:min-w-8 sm:size-8 items-center justify-center rounded-md border border-border text-text-muted transition hover:bg-surface-subtle hover:text-primary"
                        >
                          {copiedTrainerId === grant.trainerId ? (
                            <Check className="size-3.5 text-primary" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                          )}
                          {copiedTrainerId === grant.trainerId ? (
                            <span className="sr-only">Copied</span>
                          ) : null}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {state.pinErrors?.length ? (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold">
                {state.pinErrors.length} trainer{state.pinErrors.length === 1 ? '' : 's'} could not be processed
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.pinErrors.map((error) => (
                  <li key={`${error.trainerName}-${error.message}`}>
                    {error.trainerName}: {error.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
