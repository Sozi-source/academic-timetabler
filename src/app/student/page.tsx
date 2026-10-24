import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getStudentPortalAttendance } from '@/features/attendance-analytics/queries';
import {
  activeStudentUnits,
  studentRegistrationLabel,
  studentStageLabel,
} from '@/features/student-portal/domain';
import { MissedLessonsDialog } from '@/features/student-portal/missed-lessons-dialog';
import {
  getActiveStudentPortalPeriod,
  getStudentPortalDocuments,
  getStudentPortalIdentity,
  getStudentPortalRegistrationContext,
  getStudentPortalTimetable,
} from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { portalGreeting } from '@/lib/portal-greeting';

export default async function StudentPortalPage() {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const [student, period, registration, timetable, documents, attendance] = await Promise.all([
    getStudentPortalIdentity(session.studentId).catch(() => null),
    getActiveStudentPortalPeriod().catch(() => null),
    getStudentPortalRegistrationContext(session.studentId).catch(() => null),
    getStudentPortalTimetable(session.studentId).catch(() => []),
    getStudentPortalDocuments(session.studentId).catch(() => []),
    getStudentPortalAttendance(session.studentId).catch(() => null),
  ]);

  if (!student || !registration) {
    redirect('/student/login');
  }

  const units = activeStudentUnits(registration.units);
  const missedLessons = (attendance?.sessions ?? []).filter((s) => s.status === 'absent');

  const cards = [
    {
      label: 'My Units',
      value: String(units.length),
      href: '/student/units',
      icon: BookOpenCheck,
      description: 'Registered this semester',
    },
    {
      label: 'Timetable',
      value: String(timetable.length),
      href: '/student/timetable',
      icon: CalendarDays,
      description: 'Weekly scheduled classes',
    },
    {
      label: 'Documents',
      value: String(documents.length),
      href: '/student/documents',
      icon: FileText,
      description: 'Course outlines & notes',
    },
  ] as const;

  return (
    <StudentPortalShell student={student}>
      <div className="space-y-4">
        {/* Header Summary */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-primary-subtle/30 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-primary" />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Student Portal
                </p>
                {period?.name && (
                  <>
                    <span className="text-text-subtle font-mono text-[10px]">·</span>
                    <span className="font-mono text-[10.5px] font-semibold text-primary">
                      {period.name}
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                {portalGreeting(student.fullName)}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{student.programmeName}</span>
                <span className="text-text-subtle font-mono">·</span>
                <span className="font-bold text-primary">
                  {student.stageCode ?? studentStageLabel(student.academicPeriodNumber)}
                </span>
                <span className="text-text-subtle font-mono">·</span>
                <span className="font-mono font-medium text-text-muted">{student.admissionNumber}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {missedLessons.length > 0 && (
                <MissedLessonsDialog missedLessons={missedLessons} triggerVariant="compact" />
              )}
              <Badge
                variant={registration.reportingStatus === 'reported' ? 'success' : 'institutional'}
                className="px-3 py-1.5 text-xs font-bold shadow-2xs"
              >
                {registration.reportingStatus === 'reported'
                  ? 'Active · Reported'
                  : studentRegistrationLabel(registration.registrationState)}
              </Badge>
            </div>
          </div>
        </section>

        {/* Verification Alert Banner */}
        {!student.detailsVerifiedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-amber-50/80 p-3.5 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900 font-bold shadow-2xs">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-amber-950">Profile Verification Required</p>
                <p className="text-[11px] text-amber-800">
                  Please review and confirm your student biodata and contact details.
                </p>
              </div>
            </div>

            <Link
              href="/student/profile"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-amber-950 active:scale-95"
            >
              <span>Verify Profile</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        )}

        {/* Missed Lessons Notice Bar with Dialog Trigger Button */}
        {missedLessons.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/90 bg-rose-50/70 p-3 sm:px-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 shadow-2xs">
                <AlertTriangle className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-rose-950">
                    Attendance Notice
                  </p>
                  <span className="rounded-full bg-rose-200/90 px-2 py-0.2 font-mono text-[10px] font-bold text-rose-900">
                    {missedLessons.length} absent
                  </span>
                </div>
                <p className="text-[11px] text-rose-800/90">
                  It is against school regulations to miss class without permission.
                </p>
              </div>
            </div>

            <MissedLessonsDialog missedLessons={missedLessons} triggerVariant="button" />
          </div>
        )}

        {/* Metric Cards Grid */}
        <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
          {cards.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 hover:shadow-xs active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted transition-colors group-hover:text-primary">
                    {item.label}
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary transition-all duration-150 group-hover:bg-primary group-hover:text-white shadow-2xs">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-black tracking-tight text-text-primary sm:text-3xl">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>

        {/* Quick Services Navigation */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Quick Services
            </h2>
            <span className="text-[11px] text-text-subtle font-medium">
              Academic Hub
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/student/unit-registration"
              className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-institutional-yellow text-institutional-yellow-ink font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <ClipboardCheck className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Registration
                  </p>
                  <p className="text-[11px] text-text-muted">Pre-registered units</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

            <Link
              href="/student/timetable"
              className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <CalendarDays className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Timetable
                  </p>
                  <p className="text-[11px] text-text-muted">Weekly schedule</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

            <Link
              href="/student/documents"
              className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <FileText className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Documents
                  </p>
                  <p className="text-[11px] text-text-muted">Course outlines & notes</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

            <Link
              href="/student/profile"
              className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-primary border border-border font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <UserRound className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Profile
                  </p>
                  <p className="text-[11px] text-text-muted">Record & details</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </div>
        </section>

        {/* Registered Units Preview Card */}
        {units.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xs">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-surface-subtle/40">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Registered Units ({units.length})
                </h2>
              </div>
              <Link
                href="/student/units"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                <span>View All Units</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-border">
              {units.slice(0, 5).map((unit, index) => (
                <div
                  key={unit.registrationId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-primary-subtle/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[10px] font-semibold text-text-muted w-5">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-text-secondary border border-border">
                      {unit.unitCode}
                    </span>
                    <span className="truncate font-semibold text-text-primary">
                      {unit.unitName}
                    </span>
                  </div>
                  <Badge variant="success" className="text-[10px] py-0.2 shrink-0">
                    Registered
                  </Badge>
                </div>
              ))}
              {units.length > 5 && (
                <div className="bg-surface-subtle/30 px-4 py-2 text-center text-[11px] text-text-muted">
                  + {units.length - 5} more unit{units.length - 5 === 1 ? '' : 's'} registered
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </StudentPortalShell>
  );
}
