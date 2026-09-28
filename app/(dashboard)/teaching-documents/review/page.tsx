import {
  ArrowLeft,
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
  TeachingDocumentReviewActions,
} from '@/features/teaching-documents/document-review-actions';
import {
  formatTeachingDocumentFileSize,
  teachingDocumentLabel,
} from '@/features/teaching-documents/domain';
import {
  getTeachingDocumentReviewQueue,
} from '@/features/teaching-documents/queries';

function timestamp(
  value:
    string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-KE',
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

export default async function TeachingDocumentReviewPage() {
  await requireHodAccess();

  const queue =
    await getTeachingDocumentReviewQueue();

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        title="Document Review"
        icon={FileCheck2}
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
        <Badge
          variant={
            queue.length >
            0
              ? 'warning'
              : 'success'
          }
        >
          {
            queue.length
          } awaiting review
        </Badge>
      </div>

      {queue.length ===
      0 ? (
        <EmptyState
          icon={
            FileCheck2
          }
          title="Review queue is clear"
          description="Submitted teaching documents will appear here."
        />
      ) : (
        <section className="space-y-3">
          {queue.map(
            (
              item,
            ) => (
              <article
                key={
                  item.id
                }
                className="rounded-xl border border-border bg-white px-4 py-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(14rem,.7fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-text-primary">
                        {
                          item.unitName
                        }
                      </h2>

                      <Badge variant="info">
                        {teachingDocumentLabel(
                          item.documentType,
                        )}
                      </Badge>
                    </div>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {
                        item.cohortName
                      }
                      {' · '}
                      {
                        item.academicPeriodName
                      }
                    </p>

                    <div className="mt-3 grid gap-2 text-[10px] text-text-secondary grid-cols-2 sm:grid-cols-4">
                      <div>
                        <p className="font-bold uppercase tracking-wide text-text-muted">
                          Trainer
                        </p>
                        <p className="mt-0.5">
                          {
                            item.trainerName
                          }
                        </p>
                      </div>

                      <div>
                        <p className="font-bold uppercase tracking-wide text-text-muted">
                          Version
                        </p>
                        <p className="mt-0.5">
                          v{
                            item.versionNumber
                          }
                          {item.submittedRevisionNumber
                            ? ` · revision ${item.submittedRevisionNumber}`
                            : ''}
                        </p>
                      </div>

                      <div>
                        <p className="font-bold uppercase tracking-wide text-text-muted">
                          File
                        </p>
                        <p className="mt-0.5 break-words">
                          {
                            item.originalFilename ??
                            'Working document'
                          }
                        </p>
                      </div>

                      <div>
                        <p className="font-bold uppercase tracking-wide text-text-muted">
                          Submitted
                        </p>
                        <p className="mt-0.5">
                          {timestamp(
                            item.submittedAt,
                          )}
                          {' · '}
                          {formatTeachingDocumentFileSize(
                            item.fileSizeBytes,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <TeachingDocumentReviewActions
                    documentId={
                      item.id
                    }
                  />
                </div>
              </article>
            ),
          )}
        </section>
      )}
    </div>
  );
}
