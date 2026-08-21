import {
  ArrowLeft,
  Download,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  requireStaffAllocation,
} from '@/features/staff-assessment/queries';
import {
  isTeachingDocumentReady,
  teachingDocumentKinds,
} from '@/features/teaching-documents/domain';
import {
  getActiveTeachingDocumentTemplates,
  getTeachingDocumentsByAllocationIds,
} from '@/features/teaching-documents/queries';
import {
  StartTeachingDocumentButton,
} from '@/features/teaching-documents/start-document-button';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function StaffUnitDocumentsPage({
  params,
}: PageProps) {
  const profile =
    await requireTrainerAccess();

  const {
    allocationId,
  } = await params;

  const context =
    await requireStaffAllocation({
      profileId:
        profile.id,
      allocationId,
    });

  if (!context) {
    notFound();
  }

  const [
    templates,
    documents,
  ] =
    await Promise.all([
      getActiveTeachingDocumentTemplates(),
      getTeachingDocumentsByAllocationIds([
        allocationId,
      ]),
    ]);

  const templateByType =
    new Map(
      templates.map(
        (template) => [
          template.documentType,
          template,
        ],
      ),
    );

  const currentByType =
    new Map(
      documents
        .filter(
          (document) =>
            document.status !==
            'archived',
        )
        .map(
          (document) => [
            document.documentType,
            document,
          ],
        ),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Units · Documents"
        title={
          context.allocation.unitName
        }
        description={`${context.allocation.cohortName} · ${context.allocation.academicPeriodName}`}
        icon={FileText}
        actions={
          <Link
            href={`/staff/units/${allocationId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Unit
          </Link>
        }
      />

      <section className="grid gap-3 md:grid-cols-2">
        {teachingDocumentKinds.map(
          (
            kind,
          ) => {
            const template =
              templateByType.get(
                kind.value,
              );

            const current =
              currentByType.get(
                kind.value,
              );

            const templateReady =
              isTeachingDocumentReady(
                template?.status ??
                  null,
                template?.storagePath ??
                  null,
              );

            return (
              <article
                key={
                  kind.value
                }
                className="rounded-xl border border-border bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-text-primary">
                      {
                        kind.label
                      }
                    </h2>

                    <p className="mt-1 text-[11px] leading-5 text-text-muted">
                      {
                        kind.description
                      }
                    </p>
                  </div>

                  {current ? (
                    <Badge
                      variant={
                        current.status ===
                        'approved'
                          ? 'success'
                          : 'neutral'
                      }
                    >
                      {
                        current.status
                      }
                    </Badge>
                  ) : (
                    <Badge
                      variant={
                        templateReady
                          ? 'success'
                          : 'neutral'
                      }
                    >
                      {templateReady
                        ? `Template v${template?.versionNumber}`
                        : 'Template pending'}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                  <p className="text-[10px] text-text-muted">
                    {current
                      ? `Document v${current.versionNumber}`
                      : templateReady
                        ? 'Ready to start'
                        : 'Official template not connected'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {current ? (
                      <a
                        href={`/api/staff/teaching-documents/${current.id}/template`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                      >
                        <Download
                          className="size-3"
                          aria-hidden="true"
                        />
                        Template
                      </a>
                    ) : null}

                    {current?.storagePath ? (
                      <a
                        href={`/api/staff/teaching-documents/${current.id}/download`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                      >
                        <Download
                          className="size-3"
                          aria-hidden="true"
                        />
                        Document
                      </a>
                    ) : null}

                    {!current ? (
                      <StartTeachingDocumentButton
                        allocationId={
                          allocationId
                        }
                        documentType={
                          kind.value
                        }
                        disabled={
                          !templateReady
                        }
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            );
          },
        )}
      </section>

      <section className="rounded-xl border border-border bg-white px-4 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Assessment documents
        </h2>

        <p className="mt-1 text-[11px] leading-5 text-text-muted">
          CAT and Exam signing sheets
          remain controlled by their
          assessment rosters and are
          downloaded from the assessment
          workspace.
        </p>
      </section>
    </div>
  );
}
