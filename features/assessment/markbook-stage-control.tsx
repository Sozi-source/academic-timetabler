'use client';

import {
  useRef,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  Upload,
} from 'lucide-react';

export function StageAssessmentMarkbookControl({
  assessmentId,
  disabled = false,
}: {
  assessmentId: string;
  disabled?: boolean;
}) {
  const router =
    useRouter();

  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  async function stage(
    file: File,
  ) {
    setBusy(true);

    try {
      const formData =
        new FormData();

      formData.set(
        'file',
        file,
      );

      const response =
        await fetch(
          `/api/assessment/markbooks/${assessmentId}/stage`,
          {
            method:
              'POST',
            body:
              formData,
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        !response.ok
      ) {
        const firstIssue =
          payload?.issues?.[0]
            ?.message;

        window.alert(
          firstIssue ??
            payload?.message ??
            'Workbook could not be staged.',
        );

        return;
      }

      const batchId =
        payload?.batchId;

      if (
        typeof batchId !==
        'string'
      ) {
        window.alert(
          'Workbook was staged but the preview could not be opened.',
        );

        return;
      }

      router.push(
        `/assessment/marks/staged/${batchId}`,
      );
    } finally {
      setBusy(false);

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          '';
      }
    }
  }

  return (
    <>
      <input
        ref={
          inputRef
        }
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(
          event,
        ) => {
          const file =
            event
              .target
              .files?.[0];

          if (file) {
            void stage(
              file,
            );
          }
        }}
      />

      <button
        type="button"
        disabled={
          disabled ||
          busy
        }
        onClick={() =>
          inputRef.current?.click()
        }
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload
          className="size-3.5"
          aria-hidden="true"
        />

        {busy
          ? 'Staging...'
          : 'Stage marks'}
      </button>
    </>
  );
}
