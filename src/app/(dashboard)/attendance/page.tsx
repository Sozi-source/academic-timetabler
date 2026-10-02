import { BarChart3, CalendarCheck2, FileSpreadsheet, Users } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  getDepartmentAttendanceSessions,
  type AttendanceFilters,
} from '@/features/class-attendance/admin-queries';
import { AttendanceAdminTable } from '@/features/class-attendance/admin-table';
import { getDepartmentStudentAttendanceScorecard } from '@/features/class-attendance/scorecard-queries';
import { StudentAttendanceScorecard } from '@/features/class-attendance/student-attendance-scorecard';
import type { ClassSessionStatus } from '@/features/class-attendance/types';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepartmentClassAttendancePage({ searchParams }: PageProps) {
  await requireHodAccess();

  const params = await searchParams;
  const currentView =
    typeof params.view === 'string' && params.view === 'sessions' ? 'sessions' : 'scorecard';
  const periodParam =
    typeof params.academicPeriodId === 'string' ? params.academicPeriodId : undefined;

  const filters: AttendanceFilters = { limit: 250 };

  if (typeof params.academicPeriod === 'string') filters.academicPeriodName = params.academicPeriod;
  if (typeof params.unit === 'string') filters.unitName = params.unit;
  if (typeof params.cohort === 'string') filters.cohortName = params.cohort;
  if (typeof params.trainer === 'string') filters.trainerName = params.trainer;
  if (typeof params.date === 'string') filters.sessionDate = params.date;
  if (typeof params.status === 'string') filters.status = params.status as ClassSessionStatus;

  const [sessions, scorecardData] = await Promise.all([
    getDepartmentAttendanceSessions(filters),
    getDepartmentStudentAttendanceScorecard(periodParam),
  ]);

  return (
    <div className="admin-screen space-y-4">
      <PageHeader
        eyebrow="Attendance"
        title="Department Attendance"
        icon={CalendarCheck2}
        backHref="/dashboard"
        backLabel="Dashboard"
        context={
          <span className="text-xs font-medium text-text-muted">
            {scorecardData.academicPeriodName || 'Current term'}
          </span>
        }
        actions={
          <div className="flex items-center gap-1.5">
            <a
              href={`/api/attendance/scorecard/export${scorecardData.academicPeriodId ? `?periodId=${scorecardData.academicPeriodId}` : ''}`}
              aria-label="Export scorecard"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <FileSpreadsheet className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Export</span>
            </a>
            <Link
              href="/attendance-clinical/class-attendance/analytics"
              aria-label="Open attendance analytics"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <BarChart3 className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <nav
          aria-label="Attendance views"
          className="inline-flex items-center rounded-lg border border-border bg-surface-subtle p-0.5"
        >
          <Link
            href="/attendance?view=scorecard"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
              currentView === 'scorecard'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:bg-surface'
            }`}
          >
            <Users className="size-3.5" />
            <span>Students</span>
            <span className={currentView === 'scorecard' ? 'text-primary-foreground/70' : 'text-text-muted'}>
              {scorecardData.stats.totalStudents}
            </span>
          </Link>

          <Link
            href="/attendance?view=sessions"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
              currentView === 'sessions'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:bg-surface'
            }`}
          >
            <CalendarCheck2 className="size-3.5" />
            <span>Sessions</span>
            <span className={currentView === 'sessions' ? 'text-primary-foreground/70' : 'text-text-muted'}>
              {sessions.length}
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span>
            Avg <strong className="text-text-primary">{scorecardData.stats.averageAttendanceRate}%</strong>
          </span>
          {scorecardData.stats.atRiskCount > 0 ? (
            <span className="font-semibold text-danger">
              {scorecardData.stats.atRiskCount} below threshold
            </span>
          ) : null}
        </div>
      </div>

      {currentView === 'scorecard' ? (
        <StudentAttendanceScorecard scorecardData={scorecardData} />
      ) : (
        <AttendanceAdminTable items={sessions} />
      )}
    </div>
  );
}
