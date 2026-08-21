import {
  FileText,
  Layers3,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
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

  const activeByType =
    new Map(
      templates
        .filter(
          (template) =>
            template.status ===
            'active',
        )
        .map(
          (template) => [
            template.documentType,
            template,
          ],
        ),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic operations"
        title="Teaching Documents"
        description="Controlled templates and document records."
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
          status="Foundation"
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
          icon={FileText}
          status="History"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {teachingDocumentKinds.map(
          (
            kind,
          ) => {
            const template =
              activeByType.get(
                kind.value,
              );

            return (
              <article
                key={
                  kind.value
                }
                className="rounded-xl border border-border bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">
                      {
                        kind.label
                      }
                    </h2>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {
                        kind.description
                      }
                    </p>
                  </div>

                  <Badge
                    variant={
                      template
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {template
                      ? `v${template.versionNumber}`
                      : 'Not installed'}
                  </Badge>
                </div>

                <p className="mt-4 border-t border-border pt-3 text-[10px] leading-5 text-text-muted">
                  {template
                    ? template.originalFilename ??
                      template.name
                    : 'Official template file will be connected in the template-ingestion stage.'}
                </p>
              </article>
            );
          },
        )}
      </section>
    </div>
  );
}
