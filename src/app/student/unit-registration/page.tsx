import {
  ClipboardCheck,
  Download,
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
  activeStudentUnits,
  studentRegistrationLabel,
} from '@/features/student-portal/domain';
import {
  getStudentPortalRegistrationContext,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';
import {
  StudentRegistrationUnitList,
} from '@/features/student-portal/unit-registration-form';

export default async function StudentUnitRegistrationPage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const context =
    await getStudentPortalRegistrationContext(
      session.studentId,
    );

  if (!context) {
    redirect(
      '/student/login',
    );
  }

  const units =
    activeStudentUnits(
      context.units,
    );

  return (
    <StudentPortalShell
      student={
        context.student
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Department managed
            </p>

            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Unit Registration
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              {
                context.period
                  ?.name ??
                'No active academic period'
              }
            </p>
          </div>

          <Badge
            variant={
              context.registrationState ===
              'confirmed'
                ? 'success'
                : context.registrationState ===
                  'deregistered'
                  ? 'warning'
                  : 'institutional'
            }
          >
            {studentRegistrationLabel(
              context.registrationState,
            )}
          </Badge>
        </div>

        {!context.period ? (
          <EmptyState
            icon={
              ClipboardCheck
            }
            title="Registration unavailable"
            description="No active academic period."
          />
        ) : units.length ===
        0 ? (
          <EmptyState
            icon={
              ClipboardCheck
            }
            title="Not pre-registered"
            description="No units are registered for this period."
          />
        ) : (
          <>
            <Card className="px-4 py-4">
              <p className="text-xs font-semibold text-text-primary">
                {
                  context.student
                    .fullName
                }
              </p>

              <p className="mt-1 text-[10px] text-text-muted">
                {
                  context.student
                    .admissionNumber
                }
                {' · '}
                {
                  context.student
                    .cohortName ??
                  'Cohort unavailable'
                }
                {' · '}
                {
                  units.length
                } units
              </p>
            </Card>

            <Card className="border-primary/20 bg-primary/[0.035] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-text-primary">
                      Department-assigned registration
                    </p>
                    <Badge
                      variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}
                    >
                      {context.reportingStatus === 'reported'
                        ? 'Reporting confirmed'
                        : 'Reporting pending'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    Download form for clearance approvals.
                  </p>
                </div>

                <a
                  href="/api/student/unit-registration/form"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
                >
                  <Download className="size-3.5" />
                  Download form
                </a>
              </div>
            </Card>

            <StudentRegistrationUnitList
              units={
                units
              }
            />

            {context.submission
              ?.verificationNote ? (
              <p className="text-[11px] text-text-muted">
                Department note:{' '}
                {
                  context.submission
                    .verificationNote
                }
              </p>
            ) : null}
          </>
        )}
      </div>
    </StudentPortalShell>
  );
}
