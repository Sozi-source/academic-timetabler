import type {
  Metadata,
} from 'next';
import {
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  TrainerImportUploadForm,
} from '@/features/imports/trainers/trainer-import-upload-form';

export const metadata: Metadata = {
  title: 'Import Trainers',
  description:
    'Upload and validate standardized Trainer Excel workbooks.',
};

export default function ImportTrainersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title="Import trainers"
        description="Upload the standardized Trainers workbook, validate all records and review issues before inserting anything into the database."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <FileSpreadsheet
              className="size-4"
              aria-hidden="true"
            />
            Excel workbook workflow
          </div>
        }
        actions={
          <Link
            href="/timetable/trainers"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to trainers
          </Link>
        }
      />

      <div className="max-w-4xl">
        <TrainerImportUploadForm />
      </div>
    </div>
  );
}