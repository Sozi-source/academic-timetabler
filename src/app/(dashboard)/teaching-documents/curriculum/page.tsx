import {
  BookOpenCheck,
  UploadCloud,
  FileUp,
  CheckCircle2,
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
import {
  BulkCourseOutlineUploadDialog,
} from '@/features/teaching-documents/bulk-upload-dialog';

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
        icon={BookOpenCheck}
        backHref="/teaching-documents"
        backLabel="Back"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex">
              <ClearDocumentsButton />
            </span>

            <Link
              href="/teaching-documents/curriculum/bulk-upload"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold text-text-primary shadow-2xs hover:bg-surface-subtle transition"
            >
              <UploadCloud className="size-3.5 text-primary" />
              Bulk Upload
            </Link>

            <Link
              href="/teaching-documents/curriculum/individual-upload"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover transition"
            >
              <FileUp className="size-3.5" />
              Individual Upload
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
            Upload an Excel workbook or Word ZIP archive — topics distribute automatically across 14 weeks.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href="/teaching-documents/curriculum/bulk-upload"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-primary shadow-2xs hover:bg-surface-subtle"
            >
              <UploadCloud className="size-3.5 text-primary" />
              Bulk Upload
            </Link>
            <Link
              href="/teaching-documents/curriculum/individual-upload"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover"
            >
              <FileUp className="size-3.5" />
              Individual Upload
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
                      </td>

                      {/* Course Outline Column (Master Syllabus) */}
                      <td className="px-4 py-4">
                        {row.courseOutline ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-success">
                              v{row.courseOutline.versionNumber} Active
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <Link
                                href={`/teaching-documents/curriculum/individual-upload?unitId=${row.unitId}&documentType=course_outline`}
                                className="font-semibold text-primary hover:underline"
                              >
                                Replace Course Outline
                              </Link>

                              <Link
                                href={`/teaching-documents/curriculum/library/${row.unitId}/course_outline`}
                                className="font-semibold text-text-secondary hover:underline"
                              >
                                History
                              </Link>

                              <form action={retireCurriculumDocumentV54}>
                                <input
                                  type="hidden"
                                  name="documentId"
                                  value={row.courseOutline.id}
                                />
                                <button
                                  type="submit"
                                  className="font-semibold text-text-muted hover:text-danger"
                                >
                                  Retire
                                </button>
                              </form>
                            </div>

                            {row.courseOutline.sourceFileName ? (
                              <div className="max-w-[260px] truncate text-[10px] text-text-muted">
                                {row.courseOutline.sourceFileName}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-2">
                            <span className="text-xs text-text-muted">Missing</span>
                            <Link
                              href={`/teaching-documents/curriculum/individual-upload?unitId=${row.unitId}&documentType=course_outline`}
                              className="font-semibold text-primary hover:underline"
                            >
                              Upload Course Outline
                            </Link>
                          </div>
                        )}
                      </td>

                      {/* 14-Week Scheme of Work Column (Auto-Generated from Course Outline) */}
                      <td className="px-4 py-4">
                        {row.scheme ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-primary">
                              v{row.scheme.versionNumber} Custom Scheme
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <Link
                                href={`/teaching-documents/curriculum/library/${row.unitId}/scheme_of_work`}
                                className="font-semibold text-text-secondary hover:underline"
                              >
                                History
                              </Link>

                              <form action={retireCurriculumDocumentV54}>
                                <input
                                  type="hidden"
                                  name="documentId"
                                  value={row.scheme.id}
                                />
                                <button
                                  type="submit"
                                  className="font-semibold text-text-muted hover:text-danger"
                                  title="Retire custom scheme to use auto-generated scheme from Course Outline"
                                >
                                  Retire Custom
                                </button>
                              </form>
                            </div>

                            {row.scheme.sourceFileName ? (
                              <div className="max-w-[260px] truncate text-[10px] text-text-muted">
                                {row.scheme.sourceFileName}
                              </div>
                            ) : null}
                          </div>
                        ) : row.courseOutline ? (
                          <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                              Auto-Generated (Ready)
                            </div>
                            <div className="text-[11px] text-text-muted">
                              14-week schedule derived from v{row.courseOutline.versionNumber} Course Outline with CAT & exam milestones
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted">
                            Requires Course Outline
                          </div>
                        )}
                      </td>
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
