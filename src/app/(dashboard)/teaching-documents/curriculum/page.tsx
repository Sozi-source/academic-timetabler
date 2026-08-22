import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  FileCheck2,
  FileOutput,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

const curriculumActions = [
  {
    title: 'Import curriculum',
    description: 'Upload the official Excel workbook, validate it, then review before import.',
    href: '/teaching-documents/curriculum/import',
    icon: FileSpreadsheet,
  },
  {
    title: 'Download Excel template',
    description: 'Always use the latest system-generated curriculum template.',
    href: '/api/teaching-documents/curriculum/import-template',
    icon: Download,
  },
  {
    title: 'Document review',
    description: 'Review trainer-submitted controlled teaching documents.',
    href: '/teaching-documents/review',
    icon: FileCheck2,
  },
  {
    title: 'Published documents',
    description: 'View approved teaching documents currently published by the system.',
    href: '/teaching-documents/published',
    icon: FileText,
  },
  {
    title: 'Student releases',
    description: 'Control documents that are available to students.',
    href: '/teaching-documents/releases',
    icon: FileOutput,
  },
] as const;

export default async function CurriculumContentPage() {
  await requireHodAccess();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching documents"
        title="Curriculum Content"
        description="Manage the approved content used by Course Outlines and Schemes of Work."
        icon={BookOpenCheck}
        actions={
          <Link
            href="/teaching-documents"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Teaching documents
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {curriculumActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-subtle/50"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-border bg-surface-subtle p-2.5">
                  <Icon className="size-5 text-text-secondary" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold text-text-primary">{item.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-text-muted">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Curriculum content is the academic source of truth. The system applies the institutional header,
          trainer, cohort, academic period, contact hours and final document presentation at render time.
        </p>
      </section>
    </div>
  );
}
