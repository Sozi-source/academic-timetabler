import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { COLLEGE_MINIMUM_ATTENDANCE_PERCENT } from '@/features/attendance-analytics/domain';
import { getStudentPortalAttendance } from '@/features/attendance-analytics/queries';
import {
  activeStudentUnits,
  formatPortalClock,
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
import { getStudentPortalSession } from '@/features/student-portal/session';
import { portalGreeting } from '@/lib/portal-greeting';

export default async function StudentPortalPage() {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const [student, period, registration, timetable, results, documents, attendance] = await Promise.all([
    getStudentPortalIdentity(session.studentId).catch(() => null),
    getActiveStudentPortalPeriod().catch(() => null),
    getStudentPortalRegistrationContext(session.studentId).catch(() => null),
    getStudentPortalTimetable(session.studentId).catch(() => []),
    getStudentPortalResults(session.studentId).catch(() => []),
    getStudentPortalDocuments(session.studentId).catch(() => []),
    getStudentPortalAttendance(session.studentId).catch(() => null),
  ]);

  if (!student || !registration) {
    redirect('/student/login');
  }

  const units = activeStudentUnits(registration.units);
  const missedLessons = (attendance?.sessions ?? []).filter((s) => s.status === 'absent');

  const cards = [
    { label: 'My Units', value: String(units.length), href: '/student/units', icon: BookOpenCheck },
    { label: 'Timetable', value: String(timetable.length), href: '/student/timetable', icon: CalendarDays },
    { label: 'Documents', value: String(documents.length), href: '/student/documents', icon: FileText },
  ] as const;

  return (
    <StudentPortalShell student={student}>
      <div className="space-y-4">
        {/* Header Summary */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-primary" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                Student Portal
              </p>
            </div>
            <h1 className="mt-1 text-lg font-bold text-text-primary sm:text-xl">
              {portalGreeting(student.fullName)}
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              {student.programmeName} ·{' '}
              <span className="font-semibold text-primary">
                {student.stageCode ?? studentStageLabel(student.academicPeriodNumber)}
              </span>
            </p>
          </div>

          <Badge
            variant={registration.reportingStatus === 'reported' ? 'success' : 'institutional'}
            className="px-3 py-1 text-xs font-bold shadow-xs"
          >
            {registration.reportingStatus === 'reported'
              ? 'Active · Reported'
              : studentRegistrationLabel(registration.registrationState)}
          </Badge>
        </section>

        {/* Verification Alert Banner */}
        {!student.detailsVerifiedAt && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <UserRound className="size-4.5 text-amber-800" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-amber-950">Verify Details</p>
                <p className="text-[11px] text-amber-800">Confirm contact & student record.</p>
              </div>
            </div>

            <Link
              href="/student/profile"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-[11px] font-bold text-white shadow-xs transition active:scale-95"
            >
              Verify Profile
              <ChevronRight className="size-3.5" />
            </Link>
          </Card>
        )}

        {/* Missed Lessons Alert Banner */}
        {missedLessons.length > 0 && (
          <Card className="border-rose-200 bg-rose-50/70 p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                <AlertTriangle className="size-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                      Missed Lessons ({missedLessons.length})
                    </h2>
                    <span className="rounded bg-rose-200/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-900">
                      College Minimum: {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% Required
                    </span>
                  </div>
                  {attendance?.attendanceRate !== null && attendance?.attendanceRate !== undefined && (
                    <span className="font-mono text-xs font-bold text-rose-800">
                      Attendance: {attendance.attendanceRate.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-rose-800/90 leading-relaxed">
                  You were marked absent in {missedLessons.length} scheduled class session{missedLessons.length === 1 ? '' : 's'}. TVET and college academic policy requires at least {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% attendance to sit for Continuous Assessment Tests (CATs) and final examinations.
                </p>

                <div className="mt-2.5 divide-y divide-rose-200/60 rounded-lg border border-rose-200 bg-white overflow-hidden">
                  {missedLessons.slice(0, 5).map((lesson) => (
                    <div
                      key={lesson.classSessionId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary">{lesson.unitName}</span>
                        <span className="ml-2 font-mono text-[10.5px] text-text-muted">
                          {lesson.cohortName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
                        <span>{lesson.sessionDate}</span>
                        <span>·</span>
                        <span>{formatPortalClock(lesson.startsAt)}–{formatPortalClock(lesson.endsAt)}</span>
                        <Badge variant="danger" className="ml-1 text-[9px] py-0.2">
                          Absent
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {missedLessons.length > 5 && (
                    <div className="px-3 py-1.5 text-center text-[10.5px] text-rose-800 font-medium bg-rose-50/50">
                      + {missedLessons.length - 5} more missed lesson{missedLessons.length - 5 === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Metric Cards Grid */}
        <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
          {cards.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/30 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted transition-colors group-hover:text-primary">
                    {item.label}
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-black tracking-tight text-text-primary">
                  {item.value}
                </p>
              </Link>
            );
          })}
        </section>

        {/* Quick Action Cards Grid */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/student/unit-registration"
            className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink font-bold shadow-xs">
                <ClipboardCheck className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                  Registration
                </p>
                <p className="text-[11px] text-text-muted">Registered units</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>

          <Link
            href="/student/timetable"
            className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white font-bold shadow-xs">
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
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold shadow-xs">
                <FileText className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                  Documents
                </p>
                <p className="text-[11px] text-text-muted">Outlines & schemes</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>

          <Link
            href="/student/profile"
            className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/20 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-primary border border-border font-bold shadow-xs">
                <UserRound className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                  Profile
                </p>
                <p className="text-[11px] text-text-muted">Record & stage</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </section>
      </div>
    </StudentPortalShell>
  );
}
