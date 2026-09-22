import {
  ArrowLeft,
  FileOutput,
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
  TeachingDocumentStudentReleaseActions,
} from '@/features/teaching-documents/student-release-actions';
import {
  getTeachingDocumentStudentReleaseQueue,
} from '@/features/teaching-documents/student-release-queries';

function dateLabel(
  value:
    string |
    null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? value
    : new Intl.DateTimeFormat(
        'en-KE',
        {
          dateStyle:
            'medium',
        },
      ).format(
        date,
      );
}

export default async function TeachingDocumentReleasesPage() {
  await requireHodAccess();

  const documents =
    await getTeachingDocumentStudentReleaseQueue();

  const published =
    documents.filter(
      (document) =>
        Boolean(
          document.studentPublishedAt,
        ),
    ).length;

  const pending =
    documents.length -
    published;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching Documents"
        title="Student releases"
        description="Publish approved documents to students."
        icon={FileOutput}
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
        <Badge variant="success">
          {
            published
          } published
        </Badge>

        <Badge
          variant={
            pending >
            0
              ? 'warning'
              : 'neutral'
          }
        >
          {
            pending
          } awaiting publication
        </Badge>
      </div>

      {documents.length ===
      0 ? (
        <EmptyState
          icon={
            FileOutput
          }
          title="No approved documents"
          description="Approved controlled teaching documents will appear here."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {documents.map(
              (
                document,
              ) => {
                const isPublished =
                  Boolean(
                    document.studentPublishedAt,
                  );

                return (
                  <article
                    key={
                      document.id
                    }
                    className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_10rem_9rem_10rem_auto] lg:items-center"
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
                      </p>
                    </div>

                    <p className="text-[10px] text-text-secondary">
                      {
                        document.trainerName
                      }
                    </p>

                    <p className="text-[10px] text-text-muted">
                      v{
                        document.versionNumber
                      }
                      {' · '}
                      revision {
                        document.approvedRevisionNumber
                      }
                    </p>

                    <div>
                      <Badge
                        variant={
                          isPublished
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {isPublished
                          ? 'Published'
                          : 'Approved'}
                      </Badge>

                      <p className="mt-1 text-[9px] text-text-muted">
                        {isPublished
                          ? dateLabel(
                              document.studentPublishedAt,
                            )
                          : `Approved ${dateLabel(
                              document.approvedAt,
                            )}`}
                      </p>
                    </div>

                    <div className="lg:justify-self-end">
                      <TeachingDocumentStudentReleaseActions
                        documentId={
                          document.id
                        }
                        published={
                          isPublished
                        }
                      />
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>
      )}
    </div>
  );
}
