'use client';

import {
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

export default function TeachingAllocationsError({
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-danger-border bg-danger-surface px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface text-danger">
        <AlertCircle
          className="size-6"
          aria-hidden="true"
        />
      </div>

      <h1 className="mt-4 text-lg font-semibold text-text-primary">
        Teaching allocations could not be loaded
      </h1>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
        The allocation register is temporarily
        unavailable. Retry the request before making
        timetable changes.
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-5"
        leadingIcon={
          <RotateCcw
            className="size-4"
            aria-hidden="true"
          />
        }
        onClick={reset}
      >
        Try again
      </Button>
    </div>
  );
}