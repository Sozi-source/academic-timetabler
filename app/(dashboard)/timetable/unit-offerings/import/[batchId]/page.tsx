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
  UnitOfferingImportConfirmation,
} from '@/features/imports/unit-offerings/unit-offering-import-confirmation';
import {
  UnitOfferingImportPreview,
} from '@/features/imports/unit-offerings/unit-offering-import-preview';
import {
  getUnitOfferingImportBatch,
} from '@/features/imports/unit-offerings/queries';

export const metadata: Metadata = {
  title:
    'Units on Offer Import',
};

interface UnitOfferingImportBatchPageProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function UnitOfferingImportBatchPage({
  params,
}: UnitOfferingImportBatchPageProps) {
  const { batchId } = await params;

  const result =
    await getUnitOfferingImportBatch(
      batchId,
    );

  if (!result) {
    notFound();
  }

  const { batch, rows } = result;

  const insertCount =
    rows.filter((row) => {
      const normalized =
        row.normalizedData as {
          importOperation?: string;
        };

      return (
        row.status === 'valid' &&
        normalized.importOperation ===
          'insert'
      );
    }).length;

  const updateCount =
    rows.filter((row) => {
      const normalized =
        row.normalizedData as {
          importOperation?: string;
        };

      return (
        row.status === 'valid' &&
        normalized.importOperation ===
          'update'
      );
    }).length;

  const preserveCount =
    rows.filter((row) => {
      const normalized =
        row.normalizedData as {
          importOperation?: string;
        };

      return (
        row.status === 'valid' &&
        normalized.importOperation ===
          'preserve-reviewed'
      );
    }).length;

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title="Units on Offer"
        description="Review import rows."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {batch.originalFileName}
            </Badge>

            <Badge
              variant={
                batch.status ===
                'validated'
                  ? 'success'
                  : 'neutral'
              }
            >
              {batch.status}
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/unit-offerings/import"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Upload
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Workbook rows"
          value={String(batch.totalRows)}
          description="All data rows detected in the uploaded workbook."
          icon={FileSpreadsheet}
        />

        <MetricCard
          label="Valid rows"
          value={String(batch.validRows)}
          description="Rows whose required database relationships were resolved."
          icon={CheckCircle2}
        />

        <MetricCard
          label="New units"
          value={String(insertCount)}
          description="Valid rows that will create new Semester Units on Offer."
          icon={CheckCircle2}
        />

        <MetricCard
          label="Updates"
          value={String(updateCount)}
          description="Existing unreviewed units eligible for updating."
          icon={Copy}
        />

        <MetricCard
          label="Needs attention"
          value={String(
            batch.invalidRows +
              batch.duplicateRows +
              preserveCount,
          )}
          description="Invalid, duplicate or manually reviewed rows requiring awareness."
          icon={AlertTriangle}
        />
      </section>

      <UnitOfferingImportPreview
        rows={rows}
      />

      <UnitOfferingImportConfirmation
        batch={batch}
        rows={rows}
      />
    </div>
  );
}