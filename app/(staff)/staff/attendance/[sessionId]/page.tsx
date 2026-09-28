import Link from 'next/link';
import { ArrowLeft, CalendarCheck2 } from 'lucide-react';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  ClassAttendanceEditor,
} from '@/features/class-attendance/attendance-editor';
import {
  shortTime,
} from '@/features/class-attendance/domain';
import {
  getClassAttendanceWorkspace,
} from '@/features/class-attendance/queries';

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
}

export default async function StaffClassAttendanceSessionPage({
  params,
  searchParams,
}: PageProps) {
  await requireTrainerAccess();

  const { sessionId } = await params;
  const sParams = searchParams ? await searchParams : {};
  const returnTo = sParams?.returnTo;

  const workspace = await getClassAttendanceWorkspace(sessionId);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="space-y-5">
      {returnTo ? (
        <div>
          <Link
            href={returnTo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" />
            Return to Daily Report
          </Link>
        </div>
      ) : null}

      <PageHeader
        title={workspace.unitName}
        description={`${workspace.cohortName} · ${workspace.sessionDate} · ${shortTime(
          workspace.startsAt,
        )}–${shortTime(workspace.endsAt)}`}
      />

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={
            workspace.sessionStatus ===
            'completed'
              ? 'success'
              : 'warning'
          }
        >
          {workspace.sessionStatus ===
          'completed'
            ? 'Completed'
            : 'Open'}
        </Badge>

        <Badge variant="neutral">
          {
            workspace.academicPeriodName
          }
        </Badge>

        <Badge variant="neutral">
          {
            workspace.rosterCount
          } students
        </Badge>
      </div>

      <ClassAttendanceEditor
        sessionId={
          workspace.classSessionId
        }
        sessionStatus={
          workspace.sessionStatus
        }
        students={
          workspace.students
        }
        returnTo={returnTo}
      />
    </div>
  );
}
