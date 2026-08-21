'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UndoUnitRegistrationButton({
  studentId,
  academicPeriodId,
}: {
  studentId: string;
  academicPeriodId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function undo() {
    const confirmed = window.confirm(
      'Undo this unit registration? The student will return to Not registered for this Academic Period.',
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/students/unit-registration/${studentId}/undo`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            academicPeriodId,
          }),
        },
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Unit registration could not be undone.',
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
      onClick={undo}
      disabled={busy}
      className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-3 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Undoingâ€¦' : 'Undo registration'}
    </button>
  );
}
