'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface UnitOfferingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UnitOfferingsError({
  error,
  reset,
}: UnitOfferingsErrorProps) {
  return (
    <section className="rounded-2xl border border-danger/20 bg-danger-subtle p-6">
      <div className="flex items-start gap-4">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-danger"
          aria-hidden="true"
        />
        <div>
          <h1 className="font-semibold text-text-primary">
            Units on Offer could not be loaded
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {error.message}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
