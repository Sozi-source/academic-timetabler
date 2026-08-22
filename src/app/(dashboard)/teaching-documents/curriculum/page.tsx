import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function CurriculumContentPage() {
  await requireHodAccess();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching documents"
        title="Curriculum Content"
        description="Manage the academic content used to render Course Outlines and Schemes of Work."
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

      <section className="grid gap-3 md:grid-cols-2">
        <a
          href="/api/teaching-documents/curriculum/templates/course-outline"
          className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-text-primary">Course Outline Excel template</h2>
              <p className="mt-1 text-sm leading-5 text-text-muted">Unit details once, then Week 1–14 topic and specific coverage. Fixed headers.</p>
            </div>
          </div>
        </a>

        <a
          href="/api/teaching-documents/curriculum/templates/scheme-of-work"
          className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-text-primary">Scheme of Work Excel template</h2>
              <p className="mt-1 text-sm leading-5 text-text-muted">Unit details once, then Week 1–14 delivery fields. Fixed headers.</p>
            </div>
          </div>
        </a>
      </section>

      <Link
        href="/teaching-documents/curriculum/import"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5 transition hover:border-border-strong hover:bg-surface-subtle/40"
      >
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-text-primary">Import Excel</h2>
            <p className="mt-1 text-sm leading-5 text-text-muted">Upload either completed system template. The system detects its type, validates all 14 weeks, then shows a review screen before import.</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-primary">Open</span>
      </Link>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Curriculum Content stores academic data only. Academic Planner applies the institutional header, trainer, cohort, academic period, hours, approvals and final document presentation when rendering.
        </p>
      </section>
    </div>
  );
}
