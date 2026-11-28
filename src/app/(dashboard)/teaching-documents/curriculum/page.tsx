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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

          <TableContainer embedded label="Curriculum library">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Unit</TableHead>
                  <TableHead>Course Outline</TableHead>
                  <TableHead>Scheme of Work</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map(
                  (row) => (
                    <TableRow key={row.unitId}>
                      <TableCell
                        className="font-semibold text-text-primary"
                        title={row.unitCode}
                      >
                        {row.unitName}
                      </TableCell>

                      {/* Course Outline Column (Master Syllabus) */}
                      <TableCell>
                        {row.courseOutline ? (
                          <div className="inline-flex items-center gap-3 text-xs">
                            <span
                              className="font-semibold text-success"
                              title={row.courseOutline.sourceFileName ?? undefined}
                            >
                              v{row.courseOutline.versionNumber} Active
                            </span>

                            <Link
                              href={`/teaching-documents/curriculum/individual-upload?unitId=${row.unitId}&documentType=course_outline`}
                              className="font-semibold text-primary hover:underline"
                            >
                              Replace
                            </Link>

                            <Link
                              href={`/teaching-documents/curriculum/library/${row.unitId}/course_outline`}
                              className="font-semibold text-text-secondary hover:underline"
                            >
                              History
                            </Link>

                            <form action={retireCurriculumDocumentV54} className="inline">
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
                        ) : (
                          <div className="inline-flex items-center gap-3 text-xs">
                            <span className="text-text-muted">Missing</span>
                            <Link
                              href={`/teaching-documents/curriculum/individual-upload?unitId=${row.unitId}&documentType=course_outline`}
                              className="font-semibold text-primary hover:underline"
                            >
                              Upload
                            </Link>
                          </div>
                        )}
                      </TableCell>

                      {/* 14-Week Scheme of Work Column (Auto-Generated from Course Outline) */}
                      <TableCell>
                        {row.scheme ? (
                          <div className="inline-flex items-center gap-3 text-xs">
                            <span
                              className="font-semibold text-primary"
                              title={row.scheme.sourceFileName ?? undefined}
                            >
                              v{row.scheme.versionNumber} Custom
                            </span>

                            <Link
                              href={`/teaching-documents/curriculum/library/${row.unitId}/scheme_of_work`}
                              className="font-semibold text-text-secondary hover:underline"
                            >
                              History
                            </Link>

                            <form action={retireCurriculumDocumentV54} className="inline">
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
                                Retire
                              </button>
                            </form>
                          </div>
                        ) : row.courseOutline ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            title={`14-week schedule derived from v${row.courseOutline.versionNumber} Course Outline`}
                          >
                            <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                            Auto-Generated
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">
                            Requires Course Outline
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      )}
    </div>
  );
}
