'use client';

import {
  Check,
  Download,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  Textarea,
} from '@/components/ui/textarea';

export function TeachingDocumentReviewActions({
  documentId,
}: {
  documentId:
    string;
}) {
  const router =
    useRouter();

  const [
    note,
    setNote,
  ] =
    useState(
      '',
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      'approved'
      | 'returned'
      | null
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

  async function review(
    decision:
      'approved'
      | 'returned',
  ) {
    if (
      decision ===
        'returned' &&
      !note.trim()
    ) {
      setError(
        'Add a correction note before returning the document.',
      );
      return;
    }

    setBusy(
      decision,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/teaching-documents/documents/${documentId}/review`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                decision,
                note:
                  note.trim() ||
                  null,
              }),
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
          'Review could not be saved.',
        );
        return;
      }

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <div className="space-y-2.5">
      <a
        href={`/api/teaching-documents/documents/${documentId}/download`}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
      >
        <Download
          className="size-3"
          aria-hidden="true"
        />
        Review file
      </a>

      <Textarea
        value={
          note
        }
        onChange={(
          event,
        ) =>
          setNote(
            event.target.value,
          )
        }
        rows={
          2
        }
        placeholder="Correction note if returning"
        disabled={
          busy !==
          null
        }
        className="min-h-16 text-[11px]"
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            busy !==
            null
          }
          onClick={() =>
            void review(
              'returned',
            )
          }
          leadingIcon={
            busy ===
            'returned' ? (
              <LoaderCircle
                className="size-3 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RotateCcw
                className="size-3"
                aria-hidden="true"
              />
            )
          }
        >
          Return
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={
            busy !==
            null
          }
          onClick={() =>
            void review(
              'approved',
            )
          }
          leadingIcon={
            busy ===
            'approved' ? (
              <LoaderCircle
                className="size-3 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Check
                className="size-3"
                aria-hidden="true"
              />
            )
          }
        >
          Approve
        </Button>
      </div>

      {error ? (
        <p className="text-[10px] leading-4 text-danger">
          {
            error
          }
        </p>
      ) : null}
    </div>
  );
}
