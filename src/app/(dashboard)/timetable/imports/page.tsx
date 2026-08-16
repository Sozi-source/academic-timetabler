import type { Metadata } from 'next';
import {
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  TemplateDownloadLink,
} from '@/features/imports/template-download-link';
import type {
  ImportEntityType,
} from '@/features/imports/types';

export const metadata: Metadata = {
  title: 'Bulk Imports',
};

const imports: Array<{
  entity: ImportEntityType;
  title: string;
  required: string;
  href: string;
}> = [
  {
    entity: 'programmes',
    title: 'Programmes',
    required: 'Code and name',
    href: '/timetable/programmes/import',
  },
  {
    entity: 'cohorts',
    title: 'Cohorts',
    required: 'Programme code, name and intake date',
    href: '/timetable/cohorts/import',
  },
  {
    entity: 'trainers',
    title: 'Trainers',
    required: 'Staff number and full name',
    href: '/timetable/trainers/import',
  },
  {
    entity: 'units',
    title: 'Curriculum units',
    required: 'Programme code, unit code, name and period',
    href: '/timetable/units/import',
  },
  {
    entity: 'rooms',
    title: 'Rooms',
    required: 'Room code, name and capacity',
    href: '/timetable/rooms/import',
  },
  {
    entity: 'unit_offerings',
    title: 'Units on offer',
    required: 'Period, programme, cohort and unit',
    href: '/timetable/unit-offerings/import',
  },
  {
    entity: 'teaching_allocations',
    title: 'Teaching allocations',
    required: 'Period, cohort, unit and trainer codes',
    href: '/timetable/teaching-allocations/import',
  },
];

export default function BulkImportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teaching setup"
        title="Standardized bulk imports"
        description="Download a template, fill in the required columns, then validate before import."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            Seven standardized registers
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {imports.map((item) => (
          <article
            key={item.entity}
            className="flex flex-col rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="font-semibold text-text-primary">
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Required: {item.required}. All other fields are optional.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <TemplateDownloadLink
                entityType={item.entity}
                label="Download template"
              />
              <Link
                href={item.href}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Import
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
