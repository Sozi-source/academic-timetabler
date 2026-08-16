import type { Metadata } from 'next';
import {
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  MasterDataImportUploadForm,
} from '@/features/imports/master-data/master-data-import-upload-form';

export const metadata: Metadata = {
  title: 'Import Cohorts',
};

export default function ImportCohortsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title="Import cohorts"
        description="Upload the fixed-header Cohorts workbook. Programme Code, Cohort Name and Intake Date are the only required values."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            Standardized Excel workflow
          </div>
        }
        actions={
          <Link
            href="/timetable/cohorts"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to cohorts
          </Link>
        }
      />
      <div className="max-w-4xl">
        <MasterDataImportUploadForm entity="cohorts" />
      </div>
    </div>
  );
}
