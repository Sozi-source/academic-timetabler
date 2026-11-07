'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Unlock, LoaderCircle, AlertCircle } from 'lucide-react';

interface ComponentEntryStatus {
  isOpen: boolean;
  openCount: number;
  totalCount: number;
}

interface AdminDepartmentMarksEntryControlProps {
  periodId: string;
  isOpen?: boolean;
  openCount?: number;
  totalCount?: number;
  cat?: ComponentEntryStatus;
  exam?: ComponentEntryStatus;
  compact?: boolean;
}

export function AdminDepartmentMarksEntryControl({
  periodId,
  isOpen = false,
  openCount = 0,
  totalCount = 0,
  cat,
  exam,
  compact = false,
}: AdminDepartmentMarksEntryControlProps) {
  const router = useRouter();
  const [busyComponent, setBusyComponent] = useState<'cat' | 'exam' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defaults if sub-component telemetry isn't supplied
  const catStatus: ComponentEntryStatus = cat ?? {
    isOpen,
    openCount,
    totalCount,
  };
  const examStatus: ComponentEntryStatus = exam ?? {
    isOpen: false,
    openCount: 0,
    totalCount,
  };

  async function handleToggleComponent(targetComponent: 'cat' | 'exam') {
    if (!periodId || busyComponent) return;

    setBusyComponent(targetComponent);
    setError(null);

    const isCurrentlyOpen = targetComponent === 'cat' ? catStatus.isOpen : examStatus.isOpen;
    const targetOpen = !isCurrentlyOpen;

    try {
      const response = await fetch('/api/assessment/trainer-entry/department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          open: targetOpen,
          component: targetComponent,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? `Could not update ${targetComponent.toUpperCase()} entry status.`);
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to update ${targetComponent.toUpperCase()} entry status.`);
    } finally {
      setBusyComponent(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {/* ========================================================= */}
        {/* 1. CAT ENTRY WINDOW CONTROL                               */}
        {/* ========================================================= */}
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          {!compact ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                catStatus.isOpen
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${catStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              <span>
                {catStatus.isOpen
                  ? catStatus.totalCount > 0
                    ? `CAT Entry Open (${catStatus.openCount}/${catStatus.totalCount})`
                    : 'CAT Entry Open'
                  : 'CAT Entry Closed'}
              </span>
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => void handleToggleComponent('cat')}
            disabled={busyComponent !== null || !periodId}
            aria-label={catStatus.isOpen ? 'Lock CAT marks entry across all units' : 'Open CAT marks entry across all units'}
            className={`inline-flex min-h-7.5 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-2xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
              catStatus.isOpen
                ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            {busyComponent === 'cat' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : catStatus.isOpen ? (
              <Lock className="size-3.5 text-amber-700" aria-hidden="true" />
            ) : (
              <Unlock className="size-3.5 text-emerald-100" aria-hidden="true" />
            )}
            <span>
              {busyComponent === 'cat'
                ? catStatus.isOpen ? 'Closing CAT...' : 'Opening CAT...'
                : catStatus.isOpen ? 'Lock CAT Entry' : 'Open CAT Entry'}
            </span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. FINAL EXAM ENTRY WINDOW CONTROL                        */}
        {/* ========================================================= */}
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          {!compact ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                examStatus.isOpen
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${examStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              <span>
                {examStatus.isOpen
                  ? examStatus.totalCount > 0
                    ? `Exam Entry Open (${examStatus.openCount}/${examStatus.totalCount})`
                    : 'Exam Entry Open'
                  : 'Exam Entry Closed'}
              </span>
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => void handleToggleComponent('exam')}
            disabled={busyComponent !== null || !periodId}
            aria-label={examStatus.isOpen ? 'Lock Exam marks entry across all units' : 'Open Exam marks entry across all units'}
            className={`inline-flex min-h-7.5 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-2xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
              examStatus.isOpen
                ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'bg-indigo-700 text-white hover:bg-indigo-800'
            }`}
          >
            {busyComponent === 'exam' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : examStatus.isOpen ? (
              <Lock className="size-3.5 text-amber-700" aria-hidden="true" />
            ) : (
              <Unlock className="size-3.5 text-indigo-100" aria-hidden="true" />
            )}
            <span>
              {busyComponent === 'exam'
                ? examStatus.isOpen ? 'Closing Exam...' : 'Opening Exam...'
                : examStatus.isOpen ? 'Lock Exam Entry' : 'Open Exam Entry'}
            </span>
          </button>
        </div>
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
