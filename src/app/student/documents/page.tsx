import {
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
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Approved only
            </p>

            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Documents
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              Published teaching documents for your cohort.
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
            description="Documents will appear after the department approves a controlled college template output."
          />
        ) : (
          <Card className="divide-y divide-border">
            {documents.map(
              (
                document,
              ) => (
                <article
                  key={
                    document.id
                  }
                  className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
                >
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      {
                        document.documentType
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {
                        document.unitName
                      }
                    </p>
                  </div>

                  <p className="text-[10px] text-text-muted">
                    Version {
                      document.versionNumber
                    }
                  </p>

                  <Badge variant="success">
                    Approved
                  </Badge>
                </article>
              ),
            )}
          </Card>
        )}

        <p className="text-[10px] leading-4 text-text-muted">
          Controlled downloads will activate
          when the official college templates
          are connected to document storage.
        </p>
      </div>
    </StudentPortalShell>
  );
}
