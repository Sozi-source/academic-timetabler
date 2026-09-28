import type {
  Metadata,
} from 'next';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
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
  TrainerImportConfirmation,
} from '@/features/imports/trainers/trainer-import-confirmation';
import {
  TrainerImportPreview,
} from '@/features/imports/trainers/trainer-import-preview';
import {
  TrainerImportResult,
} from '@/features/imports/trainers/trainer-import-result';
import {
  getTrainerImportBatch,
} from '@/features/imports/trainers/queries';

export const metadata: Metadata = {
  title: 'Review Trainer Import',
};

interface TrainerImportPreviewPageProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function TrainerImportPreviewPage({
  params,
}: TrainerImportPreviewPageProps) {
  const { batchId } = await params;

  const result =
    await getTrainerImportBatch(batchId);

  if (!result) {
    notFound();
  }

  const { batch, rows } = result;

  const isCompleted =
    batch.status === 'completed' ||
    batch.status ===
      'completed_with_errors';

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title={
          isCompleted
            ? 'Trainer import results'
            : 'Review Trainer import'
        }
        description={
          isCompleted
            ? 'Review the final Trainer import outcome and retained row-level audit results.'
            : 'Review every spreadsheet row before confirming the final Trainer database import.'
        }
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {batch.originalFileName}
            </Badge>

            <Badge
              variant={
                isCompleted
                  ? 'success'
                  : batch.status === 'validated'
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
                ? '/timetable/trainers'
                : '/timetable/trainers/import'
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />

            {isCompleted
              ? 'Back to trainers'
              : 'Upload another file'}
          </Link>
        }
      />

      <section
        aria-label="Import validation metrics"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard
          label="Workbook rows"
          value={String(batch.totalRows)}
          description="All non-empty spreadsheet rows"
          icon={FileSpreadsheet}
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
              ? 'Trainer records created'
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
          value={String(batch.invalidRows)}
          description="Rows requiring correction"
          icon={AlertTriangle}
          status="Errors"
        />

        <MetricCard
          label="Duplicates"
          value={String(batch.duplicateRows)}
          description="Workbook or database duplicates"
          icon={Copy}
          status="Skipped"
        />
      </section>

      {isCompleted ? (
        <TrainerImportResult
          batch={batch}
        />
      ) : (
        <TrainerImportConfirmation
          batchId={batch.id}
          validRows={batch.validRows}
          invalidRows={batch.invalidRows}
          duplicateRows={batch.duplicateRows}
          batchStatus={batch.status}
        />
      )}

      <TrainerImportPreview rows={rows} />
    </div>
  );
}