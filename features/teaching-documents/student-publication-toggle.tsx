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

export function StudentPublicationToggle({
  documentId,
  visible,
}: {
  documentId:
    string;
  visible:
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

  async function toggle() {
    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/teaching-documents/documents/${documentId}/student-visibility`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                visible:
                  !visible,
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
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant={
          visible
            ? 'outline'
            : 'primary'
        }
        disabled={
          busy
        }
        onClick={() =>
          void toggle()
        }
        leadingIcon={
          busy ? (
            <LoaderCircle
              className="size-3 animate-spin"
              aria-hidden="true"
            />
          ) : visible ? (
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
        {visible
          ? 'Hide from students'
          : 'Publish to students'}
      </Button>

      {error ? (
        <p className="max-w-52 text-[9px] leading-4 text-danger">
          {
            error
          }
        </p>
      ) : null}
    </div>
  );
}
