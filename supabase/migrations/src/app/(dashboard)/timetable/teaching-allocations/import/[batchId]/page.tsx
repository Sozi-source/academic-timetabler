import type {
  Metadata,
} from 'next';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  TeachingAllocationImportConfirmation,
} from '@/features/imports/teaching-allocations/teaching-allocation-import-confirmation';
import {
  TeachingAllocationImportPreview,
} from '@/features/imports/teaching-allocations/teaching-allocation-import-preview';
import {
  TeachingAllocationImportResult,
} from '@/features/imports/teaching-allocations/teaching-allocation-import-result';
import {
  getTeachingAllocationImportBatch,
} from '@/features/imports/teaching-allocations/queries';

export const metadata: Metadata = {
  title: 'Review Teaching Allocation Import',
};

interface TeachingAllocationImportPreviewPageProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function TeachingAllocationImportPreviewPage({
  params,
}: TeachingAllocationImportPreviewPageProps) {
  const { batchId } = await params;

  const result =
    await getTeachingAllocationImportBatch(
      batchId,
    );

  if (!result) {
    notFound();
  }

  const { batch, rows } = result;

  const isCompleted =
    batch.status === 'completed' ||
    batch.status ===
      'completed_with_errors';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title={
          isCompleted
            ? 'Allocation import results'
            : 'Review teaching allocations'
        }
        description={
          isCompleted
            ? 'Review the completed import and retained row-level audit information.'
            : 'Review relationship validation, duplicate detection and scheduling readiness before confirmation.'
        }
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {batch.originalFileName}
            </Badge>

            <Badge
              variant={
                isCompleted ||
                batch.status ===
                  'validated'
                  ? 'success'
                  : 'warning'
              }
            >
              {batch.status.replaceAll(
                '_',
                ' ',
              )}
            </Badge>
          </div>
        }
        actions={
          <Link
            href={
              isCompleted
                ? '/timetable/teaching-allocations'
                : '/timetable/teaching-allocations/import'
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />

            {isCompleted
              ? 'Back to allocations'
              : 'Upload another file'}
          </Link>
        }
      />

      <section
        aria-label="Teaching Allocation import metrics"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard
          label="Workbook rows"
          value={String(
            batch.totalRows,
          )}
          description="All non-empty allocation rows"
          icon={CalendarCheck2}
          status="Total"
        />

        <MetricCard
          label={
            isCompleted
              ? 'Imported'
              : 'Ready to import'
          }
          value={String(
            isCompleted
              ? batch.importedRows
              : batch.validRows,
          )}
          description={
            isCompleted
              ? 'Allocations registered'
              : 'Rows that passed validation'
          }
          icon={CheckCircle2}
          status={
            isCompleted
              ? 'Imported'
              : 'Valid'
          }
        />

        <MetricCard
          label="Invalid rows"
          value={String(
            batch.invalidRows,
          )}
          description="Relationship or scheduling errors"
          icon={AlertTriangle}
          status="Errors"
        />

        <MetricCard
          label="Duplicates"
          value={String(
            batch.duplicateRows,
          )}
          description="Existing or repeated allocations"
          icon={Copy}
          status="Skipped"
        />
      </section>

      {isCompleted ? (
        <TeachingAllocationImportResult
          batch={batch}
        />
      ) : (
        <TeachingAllocationImportConfirmation
          batchId={batch.id}
          validRows={batch.validRows}
          invalidRows={batch.invalidRows}
          duplicateRows={
            batch.duplicateRows
          }
          batchStatus={batch.status}
        />
      )}

      <TeachingAllocationImportPreview
        rows={rows}
      />
    </div>
  );
}