'use client';

import {
  CheckCircle2,
  Download,
  FileUp,
  LoaderCircle,
  Send,
  TriangleAlert,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  type FormEvent,
  useState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';

import {
  canEditTeachingDocument,
  canSubmitTeachingDocument,
  teachingDocumentStatusLabel,
  type TeachingDocumentStatus,
} from './domain';

export function TeachingDocumentWorkflowControls({
  documentId,
  status,
  storagePath,
  reviewNote,
}: {
  documentId:
    string;
  status:
    TeachingDocumentStatus;
  storagePath:
    string | null;
  reviewNote:
    string | null;
}) {
  const router =
    useRouter();

  const [
    busy,
    setBusy,
  ] =
    useState<
      'upload'
      | 'submit'
      | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  async function upload(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(
        form,
      );

    const file =
      formData.get(
        'file',
      );

    if (
      !(
        file instanceof
        File
      ) ||
      file.size ===
        0
    ) {
      setError(
        'Choose the edited working file.',
      );
      return;
    }

    setBusy(
      'upload',
    );

    setMessage(
      null,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/teaching-documents/${documentId}/working-file`,
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

      if (!response.ok) {
        setError(
          payload?.message ??
          'Working file could not be uploaded.',
        );
        return;
      }

      form.reset();

      setMessage(
        'Working file saved as a new revision.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function submit() {
    setBusy(
      'submit',
    );

    setMessage(
      null,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/teaching-documents/${documentId}/submit`,
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
        setError(
          payload?.message ??
          'Document could not be submitted.',
        );
        return;
      }

      setMessage(
        'Submitted for review.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  const editable =
    canEditTeachingDocument(
      status,
    );

  return (
    <div className="w-full space-y-3">
      {status ===
        'returned' &&
      reviewNote ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-surface px-3 py-2.5">
          <TriangleAlert
            className="mt-0.5 size-3.5 shrink-0 text-warning"
            aria-hidden="true"
          />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-warning">
              Correction requested
            </p>

            <p className="mt-1 text-[11px] leading-5 text-text-secondary">
              {
                reviewNote
              }
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {storagePath ? (
          <a
            href={`/api/staff/teaching-documents/${documentId}/download`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <Download
              className="size-3"
              aria-hidden="true"
            />
            Working file
          </a>
        ) : null}

        {status ===
        'submitted' ? (
          <span className="text-[10px] font-semibold text-info">
            Awaiting HOD review
          </span>
        ) : null}

        {status ===
        'approved' ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success">
            <CheckCircle2
              className="size-3"
              aria-hidden="true"
            />
            Approved
          </span>
        ) : null}
      </div>

      {editable ? (
        <form
          onSubmit={
            upload
          }
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <input
            name="file"
            type="file"
            accept=".docx,.xlsx,.pdf"
            required
            disabled={
              busy !==
              null
            }
            className="block min-h-8 w-full rounded-lg border border-border-strong bg-white px-2 py-1 text-[10px] text-text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-surface-subtle file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-text-secondary"
          />

          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={
              busy !==
              null
            }
            leadingIcon={
              busy ===
              'upload' ? (
                <LoaderCircle
                  className="size-3 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FileUp
                  className="size-3"
                  aria-hidden="true"
                />
              )
            }
          >
            Upload revision
          </Button>
        </form>
      ) : null}

      {canSubmitTeachingDocument(
        status,
        storagePath,
      ) ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={
              busy !==
              null
            }
            onClick={() =>
              void submit()
            }
            leadingIcon={
              busy ===
              'submit' ? (
                <LoaderCircle
                  className="size-3 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send
                  className="size-3"
                  aria-hidden="true"
                />
              )
            }
          >
            Submit
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[10px] leading-4 text-danger">
          {
            error
          }
        </p>
      ) : null}

      {message ? (
        <p className="text-[10px] leading-4 text-success">
          {
            message
          }
        </p>
      ) : null}

      {!editable &&
      status !==
        'submitted' &&
      status !==
        'approved' ? (
        <p className="text-[10px] text-text-muted">
          {teachingDocumentStatusLabel(
            status,
          )}
        </p>
      ) : null}
    </div>
  );
}
