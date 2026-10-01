import { BarChart3, CalendarCheck2, Download, FileSpreadsheet, LayoutGrid, Users } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getDepartmentAttendanceSessions, type AttendanceFilters } from '@/features/class-attendance/admin-queries';
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
  const currentView = typeof params.view === 'string' && params.view === 'sessions' ? 'sessions' : 'scorecard';
  const periodParam = typeof params.academicPeriodId === 'string' ? params.academicPeriodId : undefined;

  const filters: AttendanceFilters = {
    limit: 250,
  };

  if (typeof params.academicPeriod === 'string') {
    filters.academicPeriodName = params.academicPeriod;
  }
  if (typeof params.unit === 'string') {
    filters.unitName = params.unit;
  }
  if (typeof params.cohort === 'string') {
    filters.cohortName = params.cohort;
  }
  if (typeof params.trainer === 'string') {
    filters.trainerName = params.trainer;
  }
  if (typeof params.date === 'string') {
    filters.sessionDate = params.date;
  }
  if (typeof params.status === 'string') {
    filters.status = params.status as ClassSessionStatus;
  }

  const [sessions, scorecardData] = await Promise.all([
    getDepartmentAttendanceSessions(filters),
    getDepartmentStudentAttendanceScorecard(periodParam),
  ]);

  // Compute student attendance percentage for sessions tab badge
  let totalPresent = 0;
  let totalAbsent = 0;
  for (const s of sessions) {
    totalPresent += s.presentCount;
    totalAbsent += s.absentCount;
  }
  const totalMarked = totalPresent + totalAbsent;
  const sessionAvgPercentage = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Attendance Oversight"
        title="Department Class Attendance"
        icon={CalendarCheck2}
        backHref="/dashboard"
        backLabel="Dashboard"
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {scorecardData.academicPeriodName || 'Current Term'}
            </Badge>
            <Badge variant="neutral">
              {scorecardData.stats.totalStudents} Active Students
            </Badge>
            {scorecardData.stats.averageAttendanceRate > 0 && (
              <Badge variant="success">
                Avg Score: {scorecardData.stats.averageAttendanceRate}%
              </Badge>
            )}
            {scorecardData.stats.atRiskCount > 0 && (
              <Badge variant="danger">
                {scorecardData.stats.atRiskCount} At Risk (&lt;80%)
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/attendance/scorecard/export${scorecardData.academicPeriodId ? `?periodId=${scorecardData.academicPeriodId}` : ''}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition shadow-2xs"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-700" aria-hidden="true" />
              <span>Export Full Scorecard</span>
            </a>

            <Link
              href="/attendance-clinical/class-attendance/analytics"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition shadow-2xs"
            >
              <BarChart3 className="size-3.5 text-primary" aria-hidden="true" />
              <span>Analytics</span>
            </Link>
          </div>
        }
      />

      {/* Main View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-surface-subtle p-1 border border-border">
          <Link
            href="/attendance?view=scorecard"
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              currentView === 'scorecard'
                ? 'bg-white text-primary shadow-2xs font-bold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="size-3.5" />
            <span>Student Attendance &amp; Scores</span>
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-800">
              {scorecardData.stats.totalStudents}
            </span>
          </Link>

          <Link
            href="/attendance?view=sessions"
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              currentView === 'sessions'
                ? 'bg-white text-primary shadow-2xs font-bold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <CalendarCheck2 className="size-3.5" />
            <span>Class Session Logs</span>
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-800">
              {sessions.length}
            </span>
          </Link>
        </div>

        {currentView === 'scorecard' && scorecardData.stats.atRiskCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
            <span className="inline-block size-2 rounded-full bg-rose-600 animate-pulse" />
            <span>{scorecardData.stats.atRiskCount} student{scorecardData.stats.atRiskCount === 1 ? '' : 's'} require attendance intervention</span>
          </div>
        )}
      </div>

      {/* Active View Content */}
      {currentView === 'scorecard' ? (
        <StudentAttendanceScorecard scorecardData={scorecardData} />
      ) : (
        <AttendanceAdminTable items={sessions} />
      )}
    </div>
  );
}
