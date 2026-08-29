import { CalendarCheck2 } from 'lucide-react';
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
  params:
    Promise<{
      sessionId:
        string;
    }>;
}

export default async function StaffClassAttendanceSessionPage({
  params,
}: PageProps) {
  await requireTrainerAccess();

  const {
    sessionId,
  } =
    await params;

  const workspace =
    await getClassAttendanceWorkspace(
      sessionId,
    );

  if (!workspace) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={workspace.unitName}
        description={`${workspace.cohortName} · ${workspace.sessionDate} · ${shortTime(
          workspace.startsAt,
        )}–${shortTime(workspace.endsAt)}`}
        backHref="/staff/attendance"
        backLabel="Attendance"
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
      />
    </div>
  );
}
