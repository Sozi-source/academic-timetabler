import type {
  Metadata,
} from 'next';
import {
  ArrowLeft,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  RoomImportUploadForm,
} from '@/features/imports/rooms/room-import-upload-form';

export const metadata: Metadata = {
  title: 'Import Rooms',
  description:
    'Upload and validate standardized Room Excel workbooks.',
};

export default function ImportRoomsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bulk data import"
        title="Import rooms"
        description="Upload the standardized Rooms workbook, validate all records and review issues before inserting them into the database."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <Building2
              className="size-4"
              aria-hidden="true"
            />
            Excel workbook workflow
          </div>
        }
        actions={
          <Link
            href="/timetable/rooms"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to rooms
          </Link>
        }
      />

      <div className="max-w-4xl">
        <RoomImportUploadForm />
      </div>
    </div>
  );
}