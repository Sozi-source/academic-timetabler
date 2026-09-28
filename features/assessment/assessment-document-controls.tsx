'use client';

import {
  useRef,
  useState,
} from 'react';
import {
  Download,
  FileCheck2,
} from 'lucide-react';

interface ValidationResponse {
  valid: boolean;
  summary: {
    totalRows: number;
    numericMarks: number;
    absences: number;
    missingMarks: number;
    issueCount: number;
  };
  issues: Array<{
    message: string;
    sheetName?: string;
    workbookRow?: number;
    admissionNumber?: string;
  }>;
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

export function AssessmentWorkbookValidationControl({
  assessmentId,
  disabled = false,
}: {
  assessmentId: string;
  disabled?: boolean;
}) {
  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  const [
    result,
    setResult,
  ] =
    useState<ValidationResponse | null>(
      null,
    );

  async function validate(
    file: File,
  ) {
    setBusy(true);
    setResult(null);

    try {
      const formData =
        new FormData();

      formData.set(
        'file',
        file,
      );

      const response =
        await fetch(
          `/api/assessment/markbooks/${assessmentId}/validate`,
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
        window.alert(
          payload?.message ??
            'Workbook could not be validated.',
        );

        return;
      }

      setResult(
        payload,
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
    <div className="flex flex-col items-start gap-1.5">
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
            void validate(
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
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileCheck2
          className="size-3.5"
          aria-hidden="true"
        />

        {busy
          ? 'Validating...'
          : 'Validate workbook'}
      </button>

      {result ? (
        <p
          className={
            result.valid
              ? 'max-w-[22rem] text-[10px] leading-4 text-emerald-700'
              : 'max-w-[22rem] text-[10px] leading-4 text-red-700'
          }
        >
          {result.valid
            ? `Valid: ${result.summary.numericMarks} marks, ${result.summary.absences} absent, ${result.summary.missingMarks} missing.`
            : `Validation found ${result.summary.issueCount} issue(s). ${result.issues[0]?.message ?? ''}`}
        </p>
      ) : null}
    </div>
  );
}
