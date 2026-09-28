'use client';

import {
  Eye,
  EyeOff,
  LoaderCircle,
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

export function TeachingDocumentStudentReleaseActions({
  documentId,
  published,
}: {
  documentId:
    string;
  published:
    boolean;
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
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  async function update() {
    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/teaching-documents/documents/${documentId}/student-publication`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                published:
                  !published,
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
          'Student publication could not be changed.',
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
    <div className="space-y-1.5">
      <Button
        type="button"
        size="sm"
        variant={
          published
            ? 'outline'
            : 'primary'
        }
        disabled={
          busy
        }
        onClick={() =>
          void update()
        }
        leadingIcon={
          busy ? (
            <LoaderCircle
              className="size-3 animate-spin"
              aria-hidden="true"
            />
          ) : published ? (
            <EyeOff
              className="size-3"
              aria-hidden="true"
            />
          ) : (
            <Eye
              className="size-3"
              aria-hidden="true"
            />
          )
        }
      >
        {published
          ? 'Unpublish'
          : 'Publish'}
      </Button>

      {error ? (
        <p className="max-w-48 text-[9px] leading-4 text-danger">
          {
            error
          }
        </p>
      ) : null}
    </div>
  );
}
