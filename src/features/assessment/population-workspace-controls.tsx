'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

export function GenerateAssessmentPopulationButton({
  assessmentId,
  hasPopulation,
}: {
  assessmentId: string;
  hasPopulation: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] =
    useState(false);

  async function generate() {
    if (
      hasPopulation &&
      !window.confirm(
        'Refresh this assessment population from current registered students? Existing absence markings will be preserved where the student remains registered.',
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/assessment/population/${assessmentId}/generate`,
        {
          method: 'POST',
        },
      );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Assessment population could not be generated.',
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
      onClick={generate}
      disabled={busy}
      className="inline-flex h-9 items-center justify-center rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy
        ? 'Generating...'
        : hasPopulation
          ? 'Refresh population'
          : 'Generate population'}
    </button>
  );
}

export function AssessmentAbsenceButton({
  assessmentId,
  studentId,
  isAbsent,
  disabled = false,
}: {
  assessmentId: string;
  studentId: string;
  isAbsent: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] =
    useState(false);

  async function update() {
    setBusy(true);

    try {
      const response = await fetch(
        `/api/assessment/population/${assessmentId}/attendance`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            studentId,
            absent: !isAbsent,
          }),
        },
      );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Assessment attendance could not be updated.',
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
      onClick={update}
      disabled={
        disabled ||
        busy
      }
      className={
        isAbsent
          ? 'inline-flex h-8 min-w-24 items-center justify-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60'
          : 'inline-flex h-8 min-w-24 items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      {busy
        ? 'Saving...'
        : isAbsent
          ? 'Clear absence'
          : 'Mark absent'}
    </button>
  );
}
