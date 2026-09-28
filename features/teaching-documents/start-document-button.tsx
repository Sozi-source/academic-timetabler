'use client';

import {
  FilePlus2,
  LoaderCircle,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import type {
  TeachingDocumentType,
} from './domain';

export function StartTeachingDocumentButton({
  allocationId,
  documentType,
  disabled,
  label = 'Start',
}: {
  allocationId: string;
  documentType: TeachingDocumentType;
  disabled: boolean;
  label?: string;
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

  async function start() {
    setBusy(
      true,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          '/api/staff/teaching-documents',
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                allocationId,
                documentType,
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
        setMessage(
          payload?.message ??
          'Document could not be prepared.',
        );

        return;
      }

      router.refresh();
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={
          disabled ||
          busy
        }
        onClick={() =>
          void start()
        }
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle
            className="size-3 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <FilePlus2
            className="size-3"
            aria-hidden="true"
          />
        )}

        {busy
          ? 'Preparing'
          : label}
      </button>

      {message ? (
        <p className="max-w-56 text-right text-[10px] text-text-muted">
          {
            message
          }
        </p>
      ) : null}
    </div>
  );
}
