'use client';

import {
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AcademicYearsErrorProps {
  reset: () => void;
}

export default function AcademicYearsError({
  reset,
}: AcademicYearsErrorProps) {
  return (
    <section className="rounded-2xl border border-danger-border bg-danger-surface px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface text-danger shadow-sm">
        <AlertTriangle
          className="size-6"
          aria-hidden="true"
        />
      </div>

      <h1 className="mt-5 text-lg font-semibold text-text-primary">
        Academic Years could not be loaded
      </h1>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
        Check the database connection and try loading the
        page again.
      </p>

      <div className="mt-6 flex justify-center">
        <Button
          variant="outline"
          leadingIcon={
            <RefreshCw
              className="size-4"
              aria-hidden="true"
            />
          }
          onClick={reset}
        >
          Try again
        </Button>
      </div>
    </section>
  );
}