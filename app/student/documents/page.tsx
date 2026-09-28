import {
  Download,
  FileText,
} from 'lucide-react';
import {
  redirect,
} from 'next/navigation';

import {
  StudentPortalShell,
} from '@/components/student/student-portal-shell';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  EmptyState,
} from '@/components/ui/empty-state';
import {
  getStudentPortalDocuments,
  getStudentPortalIdentity,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentDocumentsPage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    documents,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getStudentPortalDocuments(
        session.studentId,
      ),
    ]);

  if (!student) {
    redirect(
      '/student/login',
    );
  }

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Documents
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              Files published for your cohort.
            </p>
          </div>

          <Badge variant="neutral">
            {
              documents.length
            } documents
          </Badge>
        </div>

        {documents.length ===
        0 ? (
          <EmptyState
            icon={
              FileText
            }
            title="No published documents"
            description="Published files will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map(
              (
                document,
              ) => (
                <article
                  key={
                    document.id
                  }
                  className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs transition hover:border-primary/40 hover:bg-primary-subtle/20"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
                        <FileText className="size-4" />
                      </span>
                      <Badge variant="neutral" className="text-[10px]">
                        v{document.versionNumber}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-sm font-bold text-text-primary line-clamp-1">
                      {
                        document.documentType
                      }
                    </h2>

                    <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                      {
                        document.unitName
                      }
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex justify-end">
                    <a
                      href={`/api/student/documents/${document.id}`}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                    >
                      <Download
                        className="size-3.5"
                        aria-hidden="true"
                      />
                      Download
                    </a>
                  </div>
                </article>
              ),
            )}
          </div>
        )}

      </div>
    </StudentPortalShell>
  );
}
