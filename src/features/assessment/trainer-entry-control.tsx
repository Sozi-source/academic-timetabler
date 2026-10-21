'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TrainerEntryControl({
  assessmentId,
  isOpen,
  disabled,
}: {
  assessmentId: string;
  isOpen: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/assessment/markbooks/${assessmentId}/trainer-entry`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ open: !isOpen }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Trainer entry could not be updated.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trainer entry could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void toggle()}
        className={isOpen
          ? 'inline-flex min-h-10 items-center justify-center rounded-lg border border-warning-border bg-warning-surface px-3 text-xs font-semibold text-warning-ink hover:bg-warning-surface/70 disabled:opacity-50 sm:min-h-9'
          : 'inline-flex min-h-10 items-center justify-center rounded-lg border border-success-border bg-success-surface px-3 text-xs font-semibold text-success hover:bg-success-surface/70 disabled:opacity-50 sm:min-h-9'}
      >
        {busy ? 'Saving…' : isOpen ? 'Lock entry' : 'Open entry'}
      </button>
      {error ? <span role="alert" className="max-w-44 text-right text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
