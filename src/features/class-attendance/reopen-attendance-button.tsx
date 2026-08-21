'use client';

import {
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

export function ReopenAttendanceButton({
  sessionId,
}: {
  sessionId:
    string;
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

  async function reopen() {
    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/attendance-clinical/class-attendance/${sessionId}/reopen`,
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
          'Attendance could not be reopened.',
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
        variant="outline"
        disabled={
          busy
        }
        onClick={() =>
          void reopen()
        }
        leadingIcon={
          busy ? (
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <RotateCcw
              className="size-3.5"
              aria-hidden="true"
            />
          )
        }
      >
        Reopen
      </Button>

      {error ? (
        <p className="max-w-56 text-[10px] leading-4 text-danger">
          {
            error
          }
        </p>
      ) : null}
    </div>
  );
}
