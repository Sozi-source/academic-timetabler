import {
  BookOpenCheck,
  FileCheck2,
  FileOutput,
  FileText,
  PencilLine,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  getCurriculumLibraryCountV54,
} from '@/features/teaching-documents/curriculum-library-v54/queries';
import {
  getTeachingDocumentAdminCounts,
} from '@/features/teaching-documents/queries';

export default async function TeachingDocumentsPage() {
  await requireHodAccess();

  const [
    curriculumDocuments,
    counts,
  ] =
    await Promise.all([
      getCurriculumLibraryCountV54(),
      getTeachingDocumentAdminCounts(),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Curriculum & QA"
        title="Teaching Documents"
        description="Curriculum registry, trainer submissions and controlled student releases."
        icon={FileText}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teaching-documents/curriculum"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <BookOpenCheck className="size-3.5" aria-hidden="true" />
              Curriculum
            </Link>

            <Link
              href="/teaching-documents/releases"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <FileOutput className="size-3.5" aria-hidden="true" />
              Releases
            </Link>

            <Link
              href="/teaching-documents/review"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <FileCheck2 className="size-3.5" aria-hidden="true" />
              Review
              {counts.submitted > 0 ? (
                <span className="rounded-full bg-warning-surface px-1.5 py-0.2 text-[9px] font-bold text-warning">
                  {counts.submitted}
                </span>
              ) : null}
            </Link>
          </div>
        }
      />

      {/* 4-Metric Telemetry Strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Curriculum library"
          value={String(curriculumDocuments)}
          description="Outlines and schemes"
          icon={ShieldCheck}
          status="Controlled"
        />

        <MetricCard
          label="Awaiting review"
          value={String(counts.submitted)}
          description="Trainer submissions"
          icon={FileCheck2}
          status={counts.submitted > 0 ? 'Action' : 'Clear'}
        />

        <MetricCard
          label="Active records"
          value={String(counts.documents)}
          description="Teaching documents"
          icon={FileText}
        />

        <MetricCard
          label="Master templates"
          value={String(counts.activeTemplates)}
          description="Standard TVET templates"
          icon={BookOpenCheck}
        />
      </section>

      {/* 4 Core Operational Workspaces */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/teaching-documents/curriculum"
          className="group rounded-xl border border-border bg-white p-4 shadow-2xs transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-105">
            <BookOpenCheck className="size-4.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
            Curriculum Library
          </p>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            Manage course outlines and schemes of work.
          </p>
        </Link>

        <Link
          href="/teaching-documents/releases"
          className="group rounded-xl border border-border bg-white p-4 shadow-2xs transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-105">
            <FileOutput className="size-4.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
            Student Releases
          </p>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            Publish controlled documents to student portal.
          </p>
        </Link>

        <Link
          href="/teaching-documents/review"
          className="group rounded-xl border border-border bg-white p-4 shadow-2xs transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition group-hover:scale-105">
            <FileCheck2 className="size-4.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-text-primary group-hover:text-amber-700 transition-colors">
            Review Queue
          </p>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            Verify and approve trainer document uploads.
          </p>
        </Link>

        <Link
          href="/teaching-documents/curriculum/editor"
          className="group rounded-xl border border-border bg-white p-4 shadow-2xs transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-105">
            <PencilLine className="size-4.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
            Outline Editor
          </p>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            Draft and modify modular curriculum outlines.
          </p>
        </Link>
      </section>
    </div>
  );
}
