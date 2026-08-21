'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export function MarkbookDeleteButton({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const confirmed = window.confirm(
      'Delete this generated markbook? This is allowed only when no marks or protected academic history exist.',
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/assessment/markbooks/${assessmentId}`,
        {
          method: 'DELETE',
        },
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Markbook could not be deleted.',
        );
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Delete generated markbook"
    >
      <Trash2
        className="size-3.5"
        aria-hidden="true"
      />
      {busy ? 'Deletingâ€¦' : 'Delete'}
    </button>
  );
}
