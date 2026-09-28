import { ArrowLeft, CalendarCheck2, History } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  classAttendanceStatusVariant,
  shortTime,
} from '@/features/class-attendance/domain';
import { getClassAttendanceWorkspace } from '@/features/class-attendance/queries';
import { ReopenAttendanceButton } from '@/features/class-attendance/reopen-attendance-button';

export default async function AttendanceReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireHodAccess();

  const { sessionId } = await params;
  const workspace = await getClassAttendanceWorkspace(sessionId);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Class attendance"
        title={workspace.unitName}
        description={`${workspace.cohortName} · ${workspace.sessionDate} · ${shortTime(
          workspace.startsAt,
        )}–${shortTime(workspace.endsAt)}`}
        icon={CalendarCheck2}
        actions={
          <div className="flex gap-2">
            {workspace.sessionStatus === 'completed' ? (
              <ReopenAttendanceButton sessionId={workspace.classSessionId} />
            ) : null}
            
            <Link
              href={`/attendance/${workspace.classSessionId}/history`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <History className="size-3.5" aria-hidden="true" />
              History
            </Link>

            <Link
              href="/attendance"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={
            workspace.sessionStatus === 'completed' ? 'success' : 'warning'
          }
        >
          {workspace.sessionStatus}
        </Badge>

        <Badge variant="neutral">{workspace.rosterCount} students</Badge>
        <Badge variant="neutral">{workspace.academicPeriodName}</Badge>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,.8fr)] sm:gap-3">
          <span>Student</span>
          <span>Status</span>
          <span>Note</span>
        </div>

        <div className="divide-y divide-border">
          {workspace.students.map((student) => (
            <article
              key={student.studentId}
              className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,.8fr)] sm:items-center sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {student.fullName}
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  {student.admissionNumber}
                </p>
              </div>

              <Badge
                variant={classAttendanceStatusVariant(student.attendanceStatus)}
              >
                {student.attendanceStatus === 'present'
                  ? 'Present'
                  : student.attendanceStatus === 'absent'
                    ? 'Absent'
                    : 'Unmarked'}
              </Badge>

              <p className="text-[10px] leading-4 text-text-muted">
                {student.note ?? '—'}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
