import {
  GraduationCap,
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
  studentResultComponentDisplay,
  studentResultDisplay,
} from '@/features/student-portal/domain';
import {
  getStudentPortalIdentity,
  getStudentPortalResults,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentResultsPage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    results,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getStudentPortalResults(
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
              Published only
            </p>

            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Results
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              Finalised CAT and Exam results.
            </p>
          </div>

          <Badge variant="neutral">
            {
              results.length
            } results
          </Badge>
        </div>

        {results.length ===
        0 ? (
          <EmptyState
            icon={
              GraduationCap
            }
            title="No published results"
            description="Draft, imported or unfinalised marks are never shown here."
          />
        ) : (
          <Card className="divide-y divide-border">
            {results.map(
              (
                result,
              ) => (
                <article
                  key={
                    result.id
                  }
                  className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {
                          result.unitName
                        }
                      </p>

                      <Badge
                        variant="institutional"
                      >
                        {
                          result.assessmentType
                            .toUpperCase()
                        }
                      </Badge>
                    </div>

                    <p className="mt-1 text-[10px] text-text-muted">
                      {
                        result.periodName
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Result
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-text-primary">
                      {studentResultDisplay(
                        result,
                      )}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <Badge
                      variant={
                        result.resultStatus ===
                        'sat'
                          ? 'success'
                          : result.resultStatus ===
                            'absent'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {
                        result.resultStatus ===
                        'sat'
                          ? 'Recorded'
                          : result.resultStatus ===
                            'absent'
                            ? 'Absent'
                            : 'Pending'
                      }
                    </Badge>
                  </div>

                  {result.assessmentType ===
                    'exam' &&
                  result.resultStatus ===
                    'sat' &&
                  result.componentMarks ? (
                    <div className="sm:col-span-3 mt-1 grid grid-cols-2 gap-2 rounded-lg bg-surface-subtle px-3 py-2.5 sm:grid-cols-6">
                      {[
                        [
                          'Assignment',
                          studentResultComponentDisplay(
                            result.componentMarks.assignment,
                            5,
                          ),
                        ],
                        [
                          'Presentation',
                          studentResultComponentDisplay(
                            result.componentMarks.presentation,
                            10,
                          ),
                        ],
                        [
                          'RAT',
                          studentResultComponentDisplay(
                            result.componentMarks.rat,
                            15,
                          ),
                        ],
                        [
                          'CAT',
                          studentResultComponentDisplay(
                            result.componentMarks.cat,
                            15,
                          ),
                        ],
                        [
                          'RAT/CAT',
                          studentResultComponentDisplay(
                            result.componentMarks.ratCatAverage,
                            15,
                          ),
                        ],
                        [
                          'Exam',
                          studentResultComponentDisplay(
                            result.componentMarks.exam,
                            70,
                          ),
                        ],
                      ].map(
                        ([
                          label,
                          value,
                        ]) => (
                          <div
                            key={
                              label
                            }
                          >
                            <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted">
                              {
                                label
                              }
                            </p>
                            <p className="mt-0.5 text-[11px] font-semibold text-text-primary">
                              {
                                value
                              }
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </Card>
        )}
      </div>
    </StudentPortalShell>
  );
}
