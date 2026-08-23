import {
  ArrowLeft,
  History,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  activateCurriculumDocumentV54,
  deleteCurriculumDocumentV54,
} from '@/features/teaching-documents/curriculum-library-v54/actions';
import {
  getCurriculumDocumentHistoryV54,
} from '@/features/teaching-documents/curriculum-library-v54/queries';
import type {
  CurriculumLibraryDocumentTypeV54,
} from '@/features/teaching-documents/curriculum-library-v54/types';

export default async function CurriculumVersionHistoryPage({
  params,
}: {
  params: Promise<{
    unitId: string;
    documentType: string;
  }>;
}) {
  await requireHodAccess();

  const {
    unitId,
    documentType:
      rawDocumentType,
  } = await params;

  if (
    rawDocumentType !==
      'course_outline' &&
    rawDocumentType !==
      'scheme_of_work'
  ) {
    notFound();
  }

  const documentType =
    rawDocumentType as CurriculumLibraryDocumentTypeV54;

  const history =
    await getCurriculumDocumentHistoryV54(
      unitId,
      documentType,
    );

  if (!history.length) {
    notFound();
  }

  const first =
    history[0];

  const title =
    documentType ===
    'course_outline'
      ? 'Course Outline versions'
      : 'Scheme of Work versions';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${first.unitCode} — ${first.unitName}`}
        title={title}
        description="Previous versions remain available until permanently deleted."
        icon={History}
        actions={
          <Link
            href="/teaching-documents/curriculum"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Curriculum content
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="divide-y divide-border">
          {history.map(
            (version) => (
              <div
                key={
                  version.id
                }
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">
                      Version {
                        version.versionNumber
                      }
                    </span>

                    <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                      {
                        version.status
                      }
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-text-muted">
                    {version.sourceFileName ??
                      'No source filename'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <a
                    href={`/api/teaching-documents/curriculum/library/${version.id}/download`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Download
                  </a>

                  {version.status !==
                  'active' ? (
                    <form
                      action={
                        activateCurriculumDocumentV54
                      }
                    >
                      <input
                        type="hidden"
                        name="documentId"
                        value={
                          version.id
                        }
                      />
                      <button
                        type="submit"
                        className="font-semibold text-text-secondary hover:underline"
                      >
                        Make active
                      </button>
                    </form>
                  ) : null}

                  <form
                    action={
                      deleteCurriculumDocumentV54
                    }
                  >
                    <input
                      type="hidden"
                      name="documentId"
                      value={
                        version.id
                      }
                    />
                    <button
                      type="submit"
                      className="font-semibold text-danger hover:underline"
                    >
                      Delete permanently
                    </button>
                  </form>
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
