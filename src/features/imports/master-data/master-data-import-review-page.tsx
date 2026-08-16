import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';

import {
  MasterDataImportConfirmation,
} from './master-data-import-confirmation';
import {
  MasterDataImportPreview,
} from './master-data-import-preview';
import {
  getMasterDataImportBatch,
} from './queries';
import type {
  MasterDataImportEntity,
} from './types';

export async function MasterDataImportReviewPage({
  entity,
  batchId,
}: {
  entity: MasterDataImportEntity;
  batchId: string;
}) {
  const result =
    await getMasterDataImportBatch(
      entity,
      batchId,
    );

  if (!result) {
    notFound();
  }

  const { batch, rows } = result;
  const label =
    entity === 'programmes'
      ? 'Programme'
      : 'Cohort';
  const completed =
    batch.status === 'completed' ||
    batch.status === 'completed_with_errors';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title={
          completed
            ? `${label} import results`
            : `Review ${label} import`
        }
        description="Review validated rows before confirming the database import."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {batch.originalFileName}
            </Badge>
            <Badge
              variant={
                batch.status === 'validated' ||
                completed
                  ? 'success'
                  : 'warning'
              }
            >
              {batch.status.replaceAll('_', ' ')}
            </Badge>
          </div>
        }
        actions={
          <Link
            href={
              completed
                ? `/timetable/${entity}`
                : `/timetable/${entity}/import`
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {completed ? `Back to ${entity}` : 'Upload another file'}
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Workbook rows"
          value={String(batch.totalRows)}
          description="All non-empty spreadsheet rows"
          icon={FileSpreadsheet}
          status="Total"
        />
        <MetricCard
          label={completed ? 'Imported' : 'Ready to import'}
          value={String(
            completed
              ? batch.importedRows
              : batch.validRows,
          )}
          description="Records that passed validation"
          icon={CheckCircle2}
          status={completed ? 'Imported' : 'Valid'}
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

      <MasterDataImportConfirmation
        entity={entity}
        batchId={batch.id}
        validRows={batch.validRows}
        invalidRows={batch.invalidRows}
        duplicateRows={batch.duplicateRows}
        batchStatus={batch.status}
      />

      <MasterDataImportPreview
        entity={entity}
        rows={rows}
      />
    </div>
  );
}
