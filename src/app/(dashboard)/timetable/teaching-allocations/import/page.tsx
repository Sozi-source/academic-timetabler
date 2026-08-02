import type {
  Metadata,
} from 'next';
import {
  ArrowLeft,
  CalendarCheck2,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  TeachingAllocationImportUploadForm,
} from '@/features/imports/teaching-allocations/teaching-allocation-import-upload-form';

export const metadata: Metadata = {
  title: 'Import Teaching Allocations',
  description:
    'Upload and validate standardized Teaching Allocation Excel workbooks.',
};

export default function ImportTeachingAllocationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bulk data import"
        title="Import teaching allocations"
        description="Upload the standardized workbook, resolve all timetable relationships and review conflicts before database insertion."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <CalendarCheck2
              className="size-4"
              aria-hidden="true"
            />
            Scheduling relationship import
          </div>
        }
        actions={
          <Link
            href="/timetable/teaching-allocations"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to allocations
          </Link>
        }
      />

      <div className="max-w-4xl">
        <TeachingAllocationImportUploadForm />
      </div>
    </div>
  );
}