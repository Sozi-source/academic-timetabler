import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
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
  activeStudentUnits,
  studentRegistrationLabel,
  studentStageLabel,
} from '@/features/student-portal/domain';
import {
  getActiveStudentPortalPeriod,
  getStudentPortalDocuments,
  getStudentPortalIdentity,
  getStudentPortalRegistrationContext,
  getStudentPortalResults,
  getStudentPortalTimetable,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';
import {
  portalGreeting,
} from '@/lib/portal-greeting';

export default async function StudentPortalPage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    period,
    registration,
    timetable,
    results,
    documents,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getActiveStudentPortalPeriod(),
      getStudentPortalRegistrationContext(
        session.studentId,
      ),
      getStudentPortalTimetable(
        session.studentId,
      ),
      getStudentPortalResults(
        session.studentId,
      ),
      getStudentPortalDocuments(
        session.studentId,
      ),
    ]);

  if (
    !student ||
    !registration
  ) {
    redirect(
      '/student/login',
    );
  }

  const units =
    activeStudentUnits(
      registration.units,
    );

  const cards = [
    {
      label:
        'My Units',
      value:
        String(
          units.length,
        ),
      href:
        '/student/units',
      icon:
        BookOpenCheck,
    },
    {
      label:
        'Timetable',
      value:
        String(
          timetable.length,
        ),
      href:
        '/student/timetable',
      icon:
        CalendarDays,
    },
    {
      label:
        'Results',
      value:
        String(
          results.length,
        ),
      href:
        '/student/results',
      icon:
        GraduationCap,
    },
    {
      label:
        'Documents',
      value:
        String(
          documents.length,
        ),
      href:
        '/student/documents',
      icon:
        FileText,
    },
  ] as const;

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="space-y-5">
        <section className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Student dashboard
            </p>

            <h1 className="mt-1 text-xl font-bold text-text-primary">
              {portalGreeting(student.fullName)}
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              {
                student.programmeName
              }
              {' · '}
              {studentStageLabel(
                student.academicPeriodNumber,
              )}
            </p>
          </div>

          <Badge
            variant={
              registration.registrationState ===
              'confirmed'
                ? 'success'
                : 'institutional'
            }
          >
            {studentRegistrationLabel(
              registration.registrationState,
            )}
          </Badge>
        </section>

        {!student.detailsVerifiedAt ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Verify your profile
              </p>

              <p className="mt-0.5 text-[11px] text-text-muted">
                Confirm your student details.
              </p>
            </div>

            <Link
              href="/student/profile"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-white"
            >
              <UserRound
                className="size-3.5"
                aria-hidden="true"
              />
              Open profile
            </Link>
          </Card>
        ) : null}

        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {cards.map(
            (
              item,
            ) => {
              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className="rounded-xl border border-border bg-white px-4 py-4 shadow-sm transition hover:border-border-strong hover:bg-surface-subtle/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-text-muted">
                        {
                          item.label
                        }
                      </p>

                      <p className="mt-1 text-xl font-bold text-text-primary">
                        {
                          item.value
                        }
                      </p>

                    </div>

                    <Icon
                      className="size-4 text-text-muted"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              );
            },
          )}
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <Link
            href="/student/unit-registration"
            className="rounded-xl border border-border bg-white px-4 py-4 shadow-sm transition hover:border-border-strong"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink">
                <ClipboardCheck
                  className="size-4"
                  aria-hidden="true"
                />
              </span>

              <div>
                <p className="text-xs font-semibold text-text-primary">
                  Unit registration
                </p>

                <p className="mt-1 text-[11px] leading-5 text-text-muted">
                  View the units pre-registered
                  by your department.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/student/profile"
            className="rounded-xl border border-border bg-white px-4 py-4 shadow-sm transition hover:border-border-strong"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface-subtle text-text-secondary">
                <UserRound
                  className="size-4"
                  aria-hidden="true"
                />
              </span>

              <div>
                <p className="text-xs font-semibold text-text-primary">
                  Profile
                </p>

                <p className="mt-1 text-[11px] leading-5 text-text-muted">
                  Review your academic and
                  contact details.
                </p>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </StudentPortalShell>
  );
}
