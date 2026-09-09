import type {
  Metadata,
} from 'next';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
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
  getUnitImportBatch,
} from '@/features/imports/units/queries';
import {
  UnitImportConfirmation,
} from '@/features/imports/units/unit-import-confirmation';
import {
  UnitImportPreview,
} from '@/features/imports/units/unit-import-preview';
import {
  UnitImportResult,
} from '@/features/imports/units/unit-import-result';

export const metadata: Metadata = {
  title: 'Review Units Import',
};

interface UnitImportReviewPageProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function UnitImportReviewPage({
  params,
}: UnitImportReviewPageProps) {
  const { batchId } = await params;

  const result =
    await getUnitImportBatch(batchId);

  if (!result) {
    notFound();
  }

  const {
    batch,
    rows,
  } = result;

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
            ? 'Units import results'
            : 'Review Units import'
        }
        description={
          isCompleted
            ? 'Review the final Units import outcome and retained row-level audit results.'
            : 'Review resolved programmes, unit details and validation results before committing the Units workbook.'
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
                  : batch.status ===
                      'failed'
                    ? 'danger'
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
                ? '/timetable/units'
                : '/timetable/units/import'
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />

            {isCompleted
              ? 'Back to units'
              : 'Upload another file'}
          </Link>
        }
      />

      <section
        aria-label="Unit import metrics"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard
          label="Workbook rows"
          value={String(
            batch.totalRows,
          )}
          description="All non-empty spreadsheet rows"
          icon={BookOpen}
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
              ? 'Unit records added'
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
          description="Rows requiring correction"
          icon={AlertTriangle}
          status="Errors"
        />

        <MetricCard
          label="Duplicates"
          value={String(
            batch.duplicateRows,
          )}
          description="Workbook or database duplicates"
          icon={Copy}
          status="Skipped"
        />
      </section>

      {isCompleted ? (
        <UnitImportResult
          batch={batch}
        />
      ) : (
        <UnitImportConfirmation
          batchId={batch.id}
          validRows={batch.validRows}
          invalidRows={batch.invalidRows}
          duplicateRows={
            batch.duplicateRows
          }
          batchStatus={batch.status}
        />
      )}

      <UnitImportPreview
        rows={rows}
      />
    </div>
  );
}
