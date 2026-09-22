import {
  ArrowLeft,
  CalendarCheck2,
} from 'lucide-react';
import Link from 'next/link';
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
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  getHodClassAttendanceWorkspace,
} from '@/features/class-attendance/admin-queries';
import {
  classAttendanceStatusLabel,
  classAttendanceStatusVariant,
  shortTime,
} from '@/features/class-attendance/domain';

interface PageProps {
  params:
    Promise<{
      sessionId:
        string;
    }>;
}

export default async function HodAttendanceSessionPage({
  params,
}: PageProps) {
  await requireHodAccess();

  const {
    sessionId,
  } =
    await params;

  const workspace =
    await getHodClassAttendanceWorkspace(
      sessionId,
    );

  if (!workspace) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Class Attendance"
        title={
          workspace.unitName
        }
        description={`${workspace.cohortName} · ${workspace.sessionDate} · ${shortTime(
          workspace.startsAt,
        )}–${shortTime(
          workspace.endsAt,
        )}`}
        icon={CalendarCheck2}
        actions={
          <Link
            href="/attendance-clinical"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Attendance
          </Link>
        }
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
            workspace.trainerName
          }
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

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_minmax(8rem,.8fr)] sm:gap-3">
          <span>Student</span>
          <span>Status</span>
          <span>Note</span>
        </div>

        <div className="divide-y divide-border">
          {workspace.students.map(
            (
              student,
            ) => (
              <article
                key={
                  student.studentId
                }
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(8rem,.8fr)] sm:items-center sm:gap-3"
              >
                <div>
                  <p className="text-xs font-semibold text-text-primary">
                    {
                      student.fullName
                    }
                  </p>

                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {
                      student.admissionNumber
                    }
                  </p>
                </div>

                <Badge
                  variant={
                    classAttendanceStatusVariant(
                      student.attendanceStatus,
                    )
                  }
                >
                  {classAttendanceStatusLabel(
                    student.attendanceStatus,
                  )}
                </Badge>

                <p className="text-[10px] text-text-muted">
                  {
                    student.note ??
                    '—'
                  }
                </p>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
