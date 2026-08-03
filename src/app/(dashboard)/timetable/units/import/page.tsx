import type {
  Metadata,
} from 'next';
import {
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  UnitImportUploadForm,
} from '@/features/imports/units/unit-import-upload-form';

export const metadata: Metadata = {
  title: 'Import Units',
  description:
    'Upload and validate standardized Unit Excel workbooks.',
};

export default function ImportUnitsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title="Import units"
        description="Upload the standardized Units workbook, resolve Programme Codes and validate all curriculum records before database insertion."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <BookOpen
              className="size-4"
              aria-hidden="true"
            />
            Excel workbook workflow
          </div>
        }
        actions={
          <Link
            href="/timetable/units"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to units
          </Link>
        }
      />

      <div className="max-w-4xl">
        <UnitImportUploadForm />
      </div>
    </div>
  );
}