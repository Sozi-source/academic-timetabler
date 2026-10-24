'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  Download,
} from 'lucide-react';

type AssessmentType =
  | 'cat'
  | 'exam';

export function AssessmentTypeControl({
  assessmentId,
  value,
  disabled = false,
}: {
  assessmentId: string;
  value:
    | AssessmentType
    | null;
  disabled?: boolean;
}) {
  const router =
    useRouter();

  const [busyType, setBusyType] =
    useState<
      AssessmentType | null
    >(null);

  async function setType(
    nextType:
      AssessmentType,
  ) {
    if (
      disabled ||
      nextType === value
    ) {
      return;
    }

    setBusyType(
      nextType,
    );

    try {
      const response =
        await fetch(
          `/api/assessment/markbooks/${assessmentId}/type`,
          {
            method:
              'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                assessmentType:
                  nextType,
              }),
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
        window.alert(
          payload?.message ??
            'Assessment type could not be updated.',
        );

        return;
      }

      router.refresh();
    } finally {
      setBusyType(
        null,
      );
    }
  }

  return (
    <div className="inline-flex h-9 overflow-hidden rounded-lg border border-border bg-white">
      {(
        [
          [
            'cat',
            'CAT',
          ],
          [
            'exam',
            'Exam',
          ],
        ] as const
      ).map(
        ([
          type,
          label,
        ]) => (
          <button
            key={
              type
            }
            type="button"
            disabled={
              disabled ||
              busyType !==
                null
            }
            onClick={() =>
              void setType(
                type,
              )
            }
            className={
              value ===
              type
                ? 'inline-flex min-w-16 items-center justify-center bg-header-blue px-3 text-xs font-semibold text-white'
                : 'inline-flex min-w-16 items-center justify-center px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {busyType ===
            type
              ? 'Saving...'
              : label}
          </button>
        ),
      )}
    </div>
  );
}

function filenameFromDisposition(
  headerValue:
    | string
    | null,
  fallback: string,
): string {
  if (!headerValue) {
    return fallback;
  }

  const encoded =
    headerValue.match(
      /filename\*=UTF-8''([^;]+)/i,
    );

  if (
    encoded?.[1]
  ) {
    try {
      return decodeURIComponent(
        encoded[1],
      );
    } catch {
      return fallback;
    }
  }

  const plain =
    headerValue.match(
      /filename="([^"]+)"/i,
    );

  return (
    plain?.[1] ??
    fallback
  );
}

export function DownloadAssessmentMarkbookButton({
  assessmentId,
  unitName,
  disabled = false,
  marksSubmitted = false,
}: {
  assessmentId: string;
  unitName: string;
  disabled?: boolean;
  /**
   * Set to true only when the trainer has submitted all marks
   * (marks_submitted_at IS NOT NULL on the assessment event).
   * The download is blocked server-side until this is true.
   */
  marksSubmitted?: boolean;
}) {
  const router =
    useRouter();

  const [busy, setBusy] =
    useState(false);

  const isLocked = !marksSubmitted;

  async function download() {
    setBusy(true);

    try {
      const response =
        await fetch(
          `/api/assessment/markbooks/${assessmentId}/download`,
          {
            method:
              'POST',
          },
        );

      if (
        !response.ok
      ) {
        const payload =
          await response
            .json()
            .catch(
              () => null,
            );

        window.alert(
          payload?.message ??
            'Markbook could not be generated.',
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          'a',
        );

      anchor.href =
        url;

      anchor.download =
        filenameFromDisposition(
          response.headers.get(
            'Content-Disposition',
          ),
          `${unitName}.xlsx`,
        );

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url,
      );

      // If the DB roster was stale, warn the HOD so they know to close
      // trainer entry (which triggers a roster re-sync) to persist the fix.
      const augmentedCount = Number(
        response.headers.get('X-Markbook-Roster-Augmented') ?? '0',
      );
      if (augmentedCount > 0) {
        window.alert(
          `⚠️ Roster notice: ${augmentedCount} student(s) registered after the markbook ` +
          `roster was last synced. They have been included in this download, but the ` +
          `database roster is still stale.\n\n` +
          `To persist the fix: close Trainer Entry for this unit — this triggers an ` +
          `automatic roster re-sync so future downloads are correct without this warning.`,
        );
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (isLocked) {
    return (
      <div
        title="Waiting for trainer to submit marks before the markbook can be downloaded."
        className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-3.5 text-xs font-semibold text-slate-500"
      >
        <Download
          className="size-3.5"
          aria-hidden="true"
        />
        Awaiting mark submission
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        void download()
      }
      disabled={
        disabled ||
        busy
      }
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download
        className="size-3.5"
        aria-hidden="true"
      />

      {busy
        ? 'Generating...'
        : 'Download markbook'}
    </button>
  );
}
