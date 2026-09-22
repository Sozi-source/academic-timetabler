import type {
  Metadata,
} from 'next';
import {
  ArrowLeft,
  CalendarRange,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  UnitOfferingTemplateDownloadPanel,
  type UnitOfferingAcademicPeriodOption,
} from '@/features/imports/unit-offerings/unit-offering-template-download-panel';
import {
  createClient,
} from '@/lib/supabase/server';

import {
  UnitOfferingImportUploadForm,
} from '@/features/imports/unit-offerings/unit-offering-import-upload-form';
export const metadata: Metadata = {
  title:
    'Import Semester Units on Offer',
  description:
    'Download blank or curriculum-derived Semester Units on Offer templates.',
};

interface AcademicPeriodRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

export default async function ImportUnitOfferingsPage() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from('academic_periods')
    .select(`
      id,
      code,
      name,
      status
    `)
    .order(
      'starts_on',
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load Academic Periods: ${error.message}`,
    );
  }

  const academicPeriods =
    (
      (
        data ?? []
      ) as AcademicPeriodRow[]
    ).map(
      (
        period,
      ): UnitOfferingAcademicPeriodOption => ({
        id: period.id,
        code: period.code,
        name: period.name,
        status: period.status,
      }),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Semester planning"
        title="Import Units on Offer"
        description="Generate a prefilled workbook, or download a blank template."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <CalendarRange
              className="size-4"
              aria-hidden="true"
            />
            Programme and cohort stage driven
          </div>
        }
        actions={
          <Link
            href="/timetable/unit-offerings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to Units on Offer
          </Link>
        }
      />

      <UnitOfferingTemplateDownloadPanel
        academicPeriods={
          academicPeriods
        }
      />

      <div className="max-w-4xl">
        <UnitOfferingImportUploadForm />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 max-w-4xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Import Guidelines
        </h2>

        <ul className="mt-2.5 space-y-1.5 text-xs text-text-secondary">
          <li>• Units derive directly from active cohort programmes and current academic stages.</li>
          <li>• Inactive cohorts and non-timetabled units are excluded automatically.</li>
          <li>• Verify shared-class keys and remove unneeded units in Excel prior to upload.</li>
        </ul>
      </section>
    </div>
  );
}