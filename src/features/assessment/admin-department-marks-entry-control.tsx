'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Unlock, LoaderCircle, AlertCircle } from 'lucide-react';

interface AdminDepartmentMarksEntryControlProps {
  periodId: string;
  isOpen: boolean;
  openCount?: number;
  totalCount?: number;
  compact?: boolean;
}

export function AdminDepartmentMarksEntryControl({
  periodId,
  isOpen,
  openCount,
  totalCount,
  compact = false,
}: AdminDepartmentMarksEntryControlProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!periodId || busy) return;

    setBusy(true);
    setError(null);

    const targetOpen = !isOpen;

    try {
      const response = await fetch('/api/assessment/trainer-entry/department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          open: targetOpen,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Could not update marks entry status.');
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update marks entry status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {!compact ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
              isOpen
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
              aria-hidden="true"
            />
            <span>
              {isOpen
                ? openCount !== undefined && totalCount !== undefined && totalCount > 0
                  ? `Entry open (${openCount}/${totalCount})`
                  : 'Entry open'
                : 'Entry closed'}
            </span>
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={busy || !periodId}
          aria-label={isOpen ? 'Lock marks entry across all units' : 'Open marks entry across all units'}
          className={`inline-flex min-h-8.5 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-2xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            isOpen
              ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400'
              : 'bg-teal-700 text-white hover:bg-teal-800'
          }`}
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : isOpen ? (
            <Lock className="size-3.5 text-amber-700" aria-hidden="true" />
          ) : (
            <Unlock className="size-3.5 text-teal-100" aria-hidden="true" />
          )}
          <span>
            {busy
              ? isOpen
                ? 'Closing...'
                : 'Opening...'
              : isOpen
              ? 'Lock all entries'
              : 'Open marks entry'}
          </span>
        </button>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
