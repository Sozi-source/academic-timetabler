'use client';

import { LockKeyhole, LockKeyholeOpen, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TrainerEntryMarkbook {
  assessmentId: string;
  isOpen: boolean;
}

export function DepartmentTrainerEntryControl({
  markbooks,
}: {
  markbooks: TrainerEntryMarkbook[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const hasOpenMarkbooks = markbooks.some((markbook) => markbook.isOpen);
  const targetState = !hasOpenMarkbooks;

  async function updateMarkbooks() {
    setBusy(true);
    setMessage('');
    setError('');

    let nextIndex = 0;
    let updatedCount = 0;
    const failures: string[] = [];

    await Promise.all(Array.from({ length: Math.min(4, markbooks.length) }, async () => {
      while (nextIndex < markbooks.length) {
        const index = nextIndex;
        nextIndex += 1;
        const markbook = markbooks[index];
        if (!markbook) continue;

        try {
          const response = await fetch(`/api/assessment/markbooks/${markbook.assessmentId}/trainer-entry`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ open: targetState }),
          });
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          if (!response.ok) {
            failures.push(payload?.message ?? 'The markbook could not be updated.');
          } else {
            updatedCount += 1;
          }
        } catch {
          failures.push('A markbook could not be reached.');
        }
      }
    }));

    if (failures.length > 0) {
      setError(`Updated ${updatedCount} of ${markbooks.length}. ${failures.length} markbook${failures.length === 1 ? '' : 's'} could not be changed.`);
    } else {
      setMessage(`Trainer entry ${targetState ? 'opened' : 'locked'} for ${updatedCount} markbooks.`);
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={busy || markbooks.length === 0}
        onClick={() => void updateMarkbooks()}
        className={hasOpenMarkbooks
          ? 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-warning-border bg-warning-surface px-3.5 text-xs font-semibold text-warning-ink transition hover:bg-warning-surface/70 disabled:cursor-not-allowed disabled:opacity-50'
          : 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50'}
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : hasOpenMarkbooks ? <LockKeyhole className="size-3.5" aria-hidden="true" /> : <LockKeyholeOpen className="size-3.5" aria-hidden="true" />}
        {busy ? 'Updating entries…' : hasOpenMarkbooks ? 'Lock all entries' : 'Open all entries'}
      </button>
      {message ? <p role="status" className="text-[10px] text-success">{message}</p> : null}
      {error ? <p role="alert" className="max-w-64 text-right text-[10px] text-danger">{error}</p> : null}
      {markbooks.length === 0 ? <p className="text-[10px] text-text-muted">No active markbooks with students.</p> : null}
    </div>
  );
}
