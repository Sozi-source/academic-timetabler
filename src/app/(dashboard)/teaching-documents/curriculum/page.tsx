import {
  ArrowLeft,
  BookOpenCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  retireCurriculumDocumentV54,
} from '@/features/teaching-documents/curriculum-library-v54/actions';
import {
  getCurriculumLibraryV54,
} from '@/features/teaching-documents/curriculum-library-v54/queries';

import {
  getAssessmentMilestones,
} from '@/features/teaching-documents/assessment-milestones';
import {
  AssessmentMilestonesCard,
} from '@/features/teaching-documents/assessment-milestones-card';

import {
  ClearDocumentsButton,
} from '@/features/teaching-documents/clear-documents-button';

function documentLabel(
  value:
    | 'course_outline'
    | 'scheme_of_work',
) {
  return value ===
    'course_outline'
    ? 'Course Outline'
    : 'Scheme of Work';
}

export default async function CurriculumContentPage() {
  await requireHodAccess();

  const [documents, milestones] = await Promise.all([
    getCurriculumLibraryV54(),
    getAssessmentMilestones(),
  ]);

  const units =
    new Map<
      string,
      {
        unitId: string;
        unitCode: string;
        unitName: string;
        courseOutline:
          | (typeof documents)[number]
          | null;
        scheme:
          | (typeof documents)[number]
          | null;
      }
    >();

  for (
    const document of
    documents
  ) {
    const current =
      units.get(
        document.unitId,
      ) ?? {
        unitId:
          document.unitId,
        unitCode:
          document.unitCode,
        unitName:
          document.unitName,
        courseOutline:
          null,
        scheme:
          null,
      };

    if (
      document.documentType ===
      'course_outline'
    ) {
      current.courseOutline =
        document;
    } else {
      current.scheme =
        document;
    }

    units.set(
      document.unitId,
      current,
    );
  }

  const rows = [
    ...units.values(),
  ].sort(
    (a, b) =>
      a.unitCode.localeCompare(
        b.unitCode,
      ) ||
      a.unitName.localeCompare(
        b.unitName,
      ),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Teaching documents"
        title="Curriculum Content"
        description="Course Outlines and Schemes of Work."
        icon={BookOpenCheck}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teaching-documents"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>

            <ClearDocumentsButton />

            <Link
              href="/teaching-documents/curriculum/editor"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover transition"
            >
              <Sparkles className="size-3.5" />
              Upload Word (.docx)
            </Link>
          </div>
        }
      />

      <AssessmentMilestonesCard milestones={milestones} />

      {rows.length ===
      0 ? (
        <section className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center space-y-3">
          <div className="text-xs font-semibold text-text-primary">
            No curriculum published
          </div>
          <p className="text-[11px] text-text-muted">
            Upload a Word syllabus — topics distribute automatically across 14 weeks.
          </p>
          <div>
            <Link
              href="/teaching-documents/curriculum/editor"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm"
            >
              <Sparkles className="size-3.5" />
              Upload Word (.docx)
            </Link>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-text-primary">
              Curriculum library
            </h2>

            <p className="mt-1 text-xs text-text-muted">
              {rows.length} unit
              {rows.length ===
              1
                ? ''
                : 's'} with active curriculum.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface-subtle text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    Unit
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Course Outline
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Scheme of Work
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {rows.map(
                  (row) => (
                    <tr
                      key={
                        row.unitId
                      }
                      className="align-top"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-text-primary">
                          {
                            row.unitCode
                          }
                        </div>
                        <div className="mt-0.5 text-xs text-text-muted">
                          {
                            row.unitName
                          }
                        </div>
                        <div className="mt-2">
                          <Link
                            href={`/teaching-documents/curriculum/editor?unitId=${row.unitId}`}
                            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition"
                          >
                            <Sparkles className="size-3" />
                            Edit Online
                          </Link>
                        </div>
                      </td>

                      {[
                        row.courseOutline,
                        row.scheme,
                      ].map(
                        (
                          document,
                          index,
                        ) => (
                          <td
                            key={
                              index
                            }
                            className="px-4 py-4"
                          >
                            {document ? (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-success">
                                  v{
                                    document.versionNumber
                                  } Active
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs">
                                  <Link
                                    href={`/teaching-documents/curriculum/editor?unitId=${row.unitId}`}
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    Edit Online
                                  </Link>

                                  <Link
                                    href={`/teaching-documents/curriculum/library/${row.unitId}/${document.documentType}`}
                                    className="font-semibold text-text-secondary hover:underline"
                                  >
                                    History
                                  </Link>

                                  <form
                                    action={
                                      retireCurriculumDocumentV54
                                    }
                                  >
                                    <input
                                      type="hidden"
                                      name="documentId"
                                      value={
                                        document.id
                                      }
                                    />
                                    <button
                                      type="submit"
                                      className="font-semibold text-text-muted hover:text-danger"
                                    >
                                      Retire
                                    </button>
                                  </form>
                                </div>

                                {document.sourceFileName ? (
                                  <div className="max-w-[260px] truncate text-[10px] text-text-muted">
                                    {
                                      document.sourceFileName
                                    }
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-text-muted">
                                Missing
                              </span>
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
