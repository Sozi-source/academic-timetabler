'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  CheckCircle2,
} from 'lucide-react';

export function CommitAssessmentResultsButton({
  batchId,
  resultCount,
}: {
  batchId: string;
  resultCount: number;
}) {
  const router =
    useRouter();

  const [busy, setBusy] =
    useState(false);

  async function commit() {
    const confirmed =
      window.confirm(
        `Commit ${resultCount} assessment result${resultCount === 1 ? '' : 's'}? Existing academic results will never be overwritten and this batch becomes committed.`,
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const response =
        await fetch(
          `/api/assessment/marks/staged/${batchId}/commit`,
          {
            method:
              'POST',
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Assessment results could not be committed.',
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
      onClick={() =>
        void commit()
      }
      disabled={busy}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <CheckCircle2
        className="size-3.5"
        aria-hidden="true"
      />

      {busy
        ? 'Committing...'
        : 'Commit results'}
    </button>
  );
}
