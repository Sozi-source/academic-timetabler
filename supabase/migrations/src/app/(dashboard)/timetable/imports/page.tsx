import type { Metadata } from 'next';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { TemplateDownloadLink } from '@/features/imports/template-download-link';
import type { ImportEntityType } from '@/features/imports/types';

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
    required: 'Code, name',
    href: '/timetable/programmes/import',
  },
  {
    entity: 'cohorts',
    title: 'Cohorts',
    required: 'Programme, name, intake date',
    href: '/timetable/cohorts/import',
  },
  {
    entity: 'trainers',
    title: 'Trainers',
    required: 'Staff number, full name',
    href: '/timetable/trainers/import',
  },
  {
    entity: 'units',
    title: 'Curriculum units',
    required: 'Programme, unit code, name, period',
    href: '/timetable/units/import',
  },
  {
    entity: 'rooms',
    title: 'Rooms',
    required: 'Room code, name, capacity',
    href: '/timetable/rooms/import',
  },
  {
    entity: 'unit_offerings',
    title: 'Units on offer',
    required: 'Period, programme, cohort, unit',
    href: '/timetable/unit-offerings/import',
  },
  {
    entity: 'teaching_allocations',
    title: 'Teaching allocations',
    required: 'Period, cohort, unit, trainer',
    href: '/timetable/teaching-allocations/import',
  },
];

export default function BulkImportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk imports"
        context={
          <div className="inline-flex items-center gap-2 text-xs text-text-muted xl:text-sm">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            Only listed fields are required.
          </div>
        }
      />

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {imports.map((item) => (
          <article
            key={item.entity}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm xl:p-4"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary xl:text-base">
                {item.title}
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-text-muted xl:text-xs 2xl:text-sm">
                Required · {item.required}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TemplateDownloadLink
                entityType={item.entity}
                label="Template"
              />
              <Link
                href={item.href}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-hover xl:text-xs"
              >
                Import
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
