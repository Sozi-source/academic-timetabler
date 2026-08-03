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
        description="Generate an editable semester workbook from your registered programme structures, or download a blank template for manual preparation."
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

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text-primary">
          How the prefilled template is generated
        </h2>

        <div className="mt-4 grid gap-3 text-sm leading-6 text-text-muted md:grid-cols-2">
          <p>
            A cohort contributes units only from its
            registered programme and current academic
            stage.
          </p>

          <p>
            Inactive units, inactive cohorts and
            records disabled for timetabling are not
            included.
          </p>

          <p>
            The system does not create or guess any
            unit. Empty results mean the curriculum
            must first be configured in the database.
          </p>

          <p>
            You may edit the workbook, remove units,
            add special units and assign shared-class
            keys before uploading it.
          </p>
        </div>
      </section>
    </div>
  );
}