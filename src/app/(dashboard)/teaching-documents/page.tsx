import {
  BookOpenCheck,
  FileCheck2,
  FileOutput,
  FileText,
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
        eyebrow="Academic operations"
        title="Teaching Documents"
        description="Manage curriculum records, submissions and released documents."
        icon={FileText}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teaching-documents/curriculum"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <BookOpenCheck
                className="size-3.5"
                aria-hidden="true"
              />
              Curriculum content
            </Link>

            <Link
              href="/teaching-documents/releases"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <FileOutput
                className="size-3.5"
                aria-hidden="true"
              />
              Student releases
            </Link>

            <Link
              href="/teaching-documents/review"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <FileCheck2
                className="size-3.5"
                aria-hidden="true"
              />
              Review
              {counts.submitted > 0 ? (
                <span className="rounded-full bg-warning-surface px-1.5 py-0.5 text-[9px] font-bold text-warning">
                  {counts.submitted}
                </span>
              ) : null}
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Curriculum documents"
          value={String(
            curriculumDocuments,
          )}
          description="Active Course Outlines and Schemes"
          icon={ShieldCheck}
          status="Controlled"
        />

        <MetricCard
          label="Awaiting review"
          value={String(
            counts.submitted,
          )}
          description="Submitted by trainers"
          icon={FileCheck2}
          status={
            counts.submitted > 0
              ? 'Action'
              : 'Clear'
          }
        />
      </section>

      <Link
        href="/teaching-documents/curriculum"
        className="block rounded-xl border border-border bg-white p-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-surface-subtle p-2">
            <BookOpenCheck
              className="size-4 text-primary"
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Curriculum Content
            </h2>

            <p className="mt-1 text-[11px] leading-5 text-text-muted">
              View, download, replace and manage active Course Outlines and Schemes of Work.
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
