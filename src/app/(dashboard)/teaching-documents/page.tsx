import {
  FileText,
  Layers3,
  ShieldCheck,
} from 'lucide-react';

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
        description="Official templates and controlled document records."
        icon={FileText}
      />

      <section className="grid gap-3 sm:grid-cols-3">
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
      </section>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Upload the college-issued file unchanged.
          Every upload becomes a new draft version;
          activate only the verified institutional copy.
        </p>
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
