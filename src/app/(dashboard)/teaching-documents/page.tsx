import {
  FileCheck2,
  FileOutput,
  FileText,
  BookOpenCheck,
  Layers3,
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
  teachingDocumentKinds,
} from '@/features/teaching-documents/domain';
import {
  getTeachingDocumentAdminCounts,
  getTeachingDocumentTemplates,
} from '@/features/teaching-documents/queries';
import {
  TeachingDocumentTemplateManager,
} from '@/features/teaching-documents/template-manager';

export default async function TeachingDocumentsPage() {
  await requireHodAccess();

  const [
    templates,
    counts,
  ] =
    await Promise.all([
      getTeachingDocumentTemplates(),
      getTeachingDocumentAdminCounts(),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic operations"
        title="Teaching Documents"
        description="Curriculum content and document presentation are managed separately."
        icon={FileText}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teaching-documents/curriculum"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <BookOpenCheck className="size-3.5" aria-hidden="true" />
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
              {counts.submitted >
              0 ? (
                <span className="rounded-full bg-warning-surface px-1.5 py-0.5 text-[9px] font-bold text-warning">
                  {
                    counts.submitted
                  }
                </span>
              ) : null}
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Document types"
          value={String(
            teachingDocumentKinds.length,
          )}
          description="Controlled teaching records"
          icon={FileText}
          status="Standard"
        />

        <MetricCard
          label="Active templates"
          value={String(
            counts.activeTemplates,
          )}
          description="Institutional files ready"
          icon={Layers3}
          status="Templates"
        />

        <MetricCard
          label="Document records"
          value={String(
            counts.documents,
          )}
          description="Allocation-linked versions"
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
            counts.submitted >
            0
              ? 'Action'
              : 'Clear'
          }
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link
          href="/teaching-documents/curriculum"
          className="rounded-xl border border-border bg-white p-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-surface-subtle p-2">
              <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Curriculum Content</h2>
              <p className="mt-1 text-[11px] leading-5 text-text-muted">
                Download the fixed Excel templates, validate Course Outline or Scheme of Work content, and import it into the curriculum database.
              </p>
            </div>
          </div>
        </Link>

        <section className="rounded-xl border border-border bg-surface-subtle/50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2">
              <Layers3 className="size-4 text-text-secondary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Document Templates</h2>
              <p className="mt-1 text-[11px] leading-5 text-text-muted">
                Presentation files only. Do not upload curriculum Excel workbooks below.
              </p>
            </div>
          </div>
        </section>
      </section>

      <div className="space-y-3">
        {teachingDocumentKinds.map(
          (
            kind,
          ) => (
            <TeachingDocumentTemplateManager
              key={
                kind.value
              }
              documentType={
                kind.value
              }
              templates={
                templates.filter(
                  (template) =>
                    template.documentType ===
                    kind.value,
                )
              }
            />
          ),
        )}
      </div>
    </div>
  );
}
