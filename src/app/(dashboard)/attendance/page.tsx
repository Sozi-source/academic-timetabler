import { ArrowLeft, BarChart3, CalendarCheck2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getDepartmentAttendanceSessions, type AttendanceFilters } from '@/features/class-attendance/admin-queries';
import { AttendanceAdminTable } from '@/features/class-attendance/admin-table';
import type { ClassSessionStatus } from '@/features/class-attendance/types';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepartmentClassAttendancePage({ searchParams }: PageProps) {
  await requireHodAccess();

  const params = await searchParams;
  
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

  const sessions = await getDepartmentAttendanceSessions(filters);

  // Compute student attendance percentage for the dashboard
  let totalPresent = 0;
  let totalAbsent = 0;
  for (const s of sessions) {
    totalPresent += s.presentCount;
    totalAbsent += s.absentCount;
  }
  const totalMarked = totalPresent + totalAbsent;
  const attendancePercentage = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance"
        title="Department Class Attendance"
        description="Monitor trainer compliance and student attendance across all units."
        icon={CalendarCheck2}
        context={
          <div className="flex gap-2">
            <Badge variant="neutral">{sessions.length} sessions</Badge>
            {totalMarked > 0 && (
              <Badge variant="success">Avg Attendance: {attendancePercentage}%</Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/attendance/analytics"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Analytics
            </Link>
          </div>
        }
      />

      {/* Basic Filters UI could be added here in a client component, but search params will drive data for now */}
      <div className="rounded-xl border border-border bg-white px-4 py-3">
         <p className="text-xs text-text-muted">
           Use URL parameters (?academicPeriod=... &unit=... &cohort=... &trainer=... &date=... &status=...) to filter these results.
         </p>
      </div>

      <AttendanceAdminTable items={sessions} />
    </div>
  );
}
