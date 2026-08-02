import type {
  Metadata,
} from 'next';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
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
  RoomImportConfirmation,
} from '@/features/imports/rooms/room-import-confirmation';
import {
  RoomImportPreview,
} from '@/features/imports/rooms/room-import-preview';
import {
  RoomImportResult,
} from '@/features/imports/rooms/room-import-result';
import {
  getRoomImportBatch,
} from '@/features/imports/rooms/queries';

export const metadata: Metadata = {
  title: 'Review Rooms Import',
};

interface RoomImportPreviewPageProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function RoomImportPreviewPage({
  params,
}: RoomImportPreviewPageProps) {
  const { batchId } = await params;

  const result =
    await getRoomImportBatch(batchId);

  if (!result) {
    notFound();
  }

  const { batch, rows } = result;

  const isCompleted =
    batch.status === 'completed' ||
    batch.status ===
      'completed_with_errors';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bulk data import"
        title={
          isCompleted
            ? 'Rooms import results'
            : 'Review Rooms import'
        }
        description={
          isCompleted
            ? 'Review the final Rooms import outcome and retained row-level audit results.'
            : 'Review every workbook row before confirming the final Rooms database import.'
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
                ? '/timetable/rooms'
                : '/timetable/rooms/import'
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />

            {isCompleted
              ? 'Back to rooms'
              : 'Upload another file'}
          </Link>
        }
      />

      <section
        aria-label="Room import metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Workbook rows"
          value={String(
            batch.totalRows,
          )}
          description="All non-empty spreadsheet rows"
          icon={Building2}
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
              ? 'Room records created'
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
        <RoomImportResult
          batch={batch}
        />
      ) : (
        <RoomImportConfirmation
          batchId={batch.id}
          validRows={batch.validRows}
          invalidRows={batch.invalidRows}
          duplicateRows={
            batch.duplicateRows
          }
          batchStatus={batch.status}
        />
      )}

      <RoomImportPreview rows={rows} />
    </div>
  );
}