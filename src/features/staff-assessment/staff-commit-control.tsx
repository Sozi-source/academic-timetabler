'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';

import {
  canCommitStaffBatch,
} from './workflow-domain';

export function StaffCommitControl({
  batchId,
  allocationId,
  rootAssessmentId,
  status,
  totalRows,
  missingMarks,
}: {
  batchId: string;
  allocationId: string | null;
  rootAssessmentId: string;
  status: string;
  totalRows: number;
  missingMarks: number;
}) {
  const router =
    useRouter();

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  const canCommit =
    canCommitStaffBatch({
      status,
      totalRows,
      missingMarks,
    });

  async function commit() {
    if (
      !window.confirm(
        'Commit these validated results?',
      )
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/marks/staged/${batchId}/commit`,
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
        setMessage(
          payload?.message ??
          'Results could not be committed.',
        );

        return;
      }

      if (allocationId) {
        router.push(
          `/staff/units/${allocationId}/assessment/${rootAssessmentId}`,
        );
      } else {
        router.push(
          '/staff/units',
        );
      }

      router.refresh();
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={
          !canCommit ||
          busy
        }
        onClick={() =>
          void commit()
        }
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle
            className="size-3.5 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="size-3.5"
            aria-hidden="true"
          />
        )}

        {busy
          ? 'Committing...'
          : 'Commit results'}
      </button>

      {message ? (
        <p className="text-[11px] font-medium text-text-secondary">
          {
            message
          }
        </p>
      ) : null}
    </div>
  );
}
