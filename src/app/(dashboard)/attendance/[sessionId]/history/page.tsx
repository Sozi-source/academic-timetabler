import { ArrowLeft, CalendarCheck2, Clock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { shortTime } from '@/features/class-attendance/domain';
import { getClassAttendanceWorkspace } from '@/features/class-attendance/queries';

export default async function AttendanceHistoryPage({
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance Audit"
        title="Session History"
        description={`${workspace.unitName} · ${workspace.sessionDate}`}
        icon={Clock}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/attendance/${workspace.classSessionId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to Session
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
        <Badge variant="neutral">{workspace.cohortName}</Badge>
        <Badge variant="neutral">
          {shortTime(workspace.startsAt)}–{shortTime(workspace.endsAt)}
        </Badge>
      </div>

      <section className="rounded-xl border border-border bg-white p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">
          Audit history pending
        </p>
        <p className="mt-1 text-xs text-text-muted">
          The detailed state transition timeline (open, completed, reopened) will appear here once the audit endpoint is connected.
        </p>
      </section>
    </div>
  );
}
