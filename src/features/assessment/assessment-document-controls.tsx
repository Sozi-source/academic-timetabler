'use client';

import {
  useState,
} from 'react';
import {
  Download,
} from 'lucide-react';

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

export function DownloadAssessmentSigningSheetButton({
  assessmentId,
  unitName,
  assessmentType,
  disabled = false,
}: {
  assessmentId: string;
  unitName: string;
  assessmentType:
    | 'cat'
    | 'exam'
    | null;
  disabled?: boolean;
}) {
  const [busy, setBusy] =
    useState(false);

  async function download() {
    setBusy(true);

    try {
      const response =
        await fetch(
          `/api/assessment/signing-sheets/${assessmentId}/download`,
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
            'Signing sheet could not be generated.',
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

      const typeLabel =
        assessmentType ===
        'exam'
          ? 'Exam'
          : 'CAT';

      anchor.download =
        filenameFromDisposition(
          response.headers.get(
            'Content-Disposition',
          ),
          `${unitName} - ${typeLabel} Signing Sheet.xlsx`,
        );

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url,
      );
    } finally {
      setBusy(false);
    }
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
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download
        className="size-3.5"
        aria-hidden="true"
      />

      {busy
        ? 'Generating...'
        : 'Signing sheet'}
    </button>
  );
}
