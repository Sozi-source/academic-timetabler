import Link from 'next/link';
import {
  loadTrainerDocumentSummaryV53,
} from '@/features/teaching-documents/trainer-workbook-v53/queries';
import {
  uploadTrainerTeachingWorkbookV53,
} from '@/features/teaching-documents/trainer-workbook-v53/actions';

function DocumentCard(props: {
  title: string;
  active: number;
  total: number;
  missing: number;
  downloadHref: string;
}) {
  const complete = props.missing === 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">
            {props.title}
          </h2>

          <p className="mt-1 text-sm text-text-muted">
            {props.active} of {props.total} uploaded
          </p>
        </div>

        <span className="text-sm font-medium text-text-secondary">
          {complete
            ? 'Up to date'
            : `${props.missing} missing`}
        </span>
      </div>

      {!complete ? (
        <div className="mt-4">
          <Link
            href={props.downloadHref}
            className="inline-flex h-10 items-center rounded-lg border border-border-strong bg-white px-3.5 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            Generate missing workbook
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export default async function StaffTeachingDocumentsPage() {
  const summary =
    await loadTrainerDocumentSummaryV53();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-primary">
          Teaching Documents
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-text-primary">
          My teaching documents
        </h1>

        <p className="mt-1 text-sm text-text-muted">
          Generate missing units, complete the workbook, then upload it.
        </p>
      </header>

      {summary.totalAllocations === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="font-semibold text-text-primary">
            No teaching allocations
          </h2>

          <p className="mt-1 text-sm text-text-muted">
            Documents will appear when units are allocated to you.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <DocumentCard
              title="Course Outlines"
              active={summary.activeCourseOutlines}
              total={summary.totalAllocations}
              missing={summary.missingCourseOutlines.length}
              downloadHref="/api/staff/teaching-documents/missing-workbook/course-outline"
            />

            <DocumentCard
              title="Schemes of Work"
              active={summary.activeSchemes}
              total={summary.totalAllocations}
              missing={summary.missingSchemes.length}
              downloadHref="/api/staff/teaching-documents/missing-workbook/scheme-of-work"
            />
          </div>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-text-primary">
              Upload workbook
            </h2>

            <form
              action={uploadTrainerTeachingWorkbookV53}
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <input
                name="workbook"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="min-w-0 flex-1 text-sm text-text-muted"
              />

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
              >
                Upload workbook
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
