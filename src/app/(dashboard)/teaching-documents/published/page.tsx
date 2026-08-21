import {
  ArrowLeft,
  Eye,
  FileCheck2,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  EmptyState,
} from '@/components/ui/empty-state';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  teachingDocumentLabel,
} from '@/features/teaching-documents/domain';
import {
  getApprovedTeachingDocuments,
} from '@/features/teaching-documents/publication-queries';
import {
  StudentPublicationToggle,
} from '@/features/teaching-documents/student-publication-toggle';

export default async function StudentDocumentPublicationPage() {
  await requireHodAccess();

  const documents =
    await getApprovedTeachingDocuments();

  const visible =
    documents.filter(
      (document) =>
        document.studentVisible,
    ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching Documents"
        title="Student Publication"
        description="Control which approved documents students can download."
        icon={Eye}
        actions={
          <Link
            href="/teaching-documents"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Templates
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {
            documents.length
          } approved
        </Badge>

        <Badge
          variant={
            visible >
            0
              ? 'success'
              : 'neutral'
          }
        >
          {
            visible
          } student visible
        </Badge>
      </div>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Approval and student publication are separate.
          Approved files remain private until explicitly
          published here.
        </p>
      </section>

      {documents.length ===
      0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No approved documents"
          description="Approved teaching documents will appear here."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {documents.map(
              (
                document,
              ) => (
                <article
                  key={
                    document.id
                  }
                  className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(10rem,.7fr)_8rem_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        document.unitName
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {teachingDocumentLabel(
                        document.documentType,
                      )}
                      {' · '}
                      {
                        document.cohortName
                      }
                      {' · '}
                      {
                        document.trainerName
                      }
                    </p>
                  </div>

                  <p className="text-[10px] text-text-secondary">
                    {
                      document.academicPeriodName
                    }
                    {' · '}
                    v{
                      document.versionNumber
                    }
                    {' · '}
                    revision {
                      document.approvedRevisionNumber
                    }
                  </p>

                  <Badge
                    variant={
                      document.studentVisible
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {document.studentVisible
                      ? 'Published'
                      : 'Private'}
                  </Badge>

                  <div className="flex justify-end">
                    <StudentPublicationToggle
                      documentId={
                        document.id
                      }
                      visible={
                        document.studentVisible
                      }
                    />
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
