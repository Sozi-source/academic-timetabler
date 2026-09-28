import {
  CalendarCheck2,
  CheckCircle2,
  ExternalLink,
  SkipForward,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import {
  MetricCard,
} from '@/components/ui/metric-card';

import type {
  TeachingAllocationImportBatch,
} from './types';

export function TeachingAllocationImportResult({
  batch,
}: {
  batch: TeachingAllocationImportBatch;
}) {
  const completed =
    batch.status === 'completed' ||
    batch.status ===
      'completed_with_errors';

  if (!completed) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-success-border bg-success-surface px-5 py-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-success"
            aria-hidden="true"
          />

          <div>
            <h2 className="font-semibold text-text-primary">
              Allocation import completed
            </h2>

            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Valid Teaching Allocations were added.
              Skipped rows remain available in the
              row-level import audit below.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Imported allocations"
          value={String(
            batch.importedRows,
          )}
          description="Teaching requirements registered"
          icon={CalendarCheck2}
          status="Imported"
        />

        <MetricCard
          label="Skipped rows"
          value={String(
            batch.skippedRows,
          )}
          description="Invalid or duplicate records"
          icon={SkipForward}
          status="Skipped"
        />

        <MetricCard
          label="Failed rows"
          value={String(
            batch.failedRows,
          )}
          description="Rows that could not be processed"
          icon={XCircle}
          status="Failed"
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/timetable/teaching-allocations"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
        >
          View allocation register

          <ExternalLink
            className="size-4"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}