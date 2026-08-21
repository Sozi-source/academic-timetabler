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
  getDepartmentAttendanceWorkspace,
} from '@/features/class-attendance/admin-queries';
import {
  classAttendanceStatusVariant,
  classAttendanceSummary,
  shortTime,
} from '@/features/class-attendance/domain';
import {
  ReopenAttendanceButton,
} from '@/features/class-attendance/reopen-attendance-button';

interface PageProps {
  params:
    Promise<{
      sessionId:
        string;
    }>;
}

export default async function DepartmentAttendanceSessionPage({
  params,
}: PageProps) {
  await requireHodAccess();

  const {
    sessionId,
  } =
    await params;

  const workspace =
    await getDepartmentAttendanceWorkspace(
      sessionId,
    );

  if (!workspace) {
    notFound();
  }

  const summary =
    classAttendanceSummary(
      workspace.students.map(
        (student) =>
          student.attendanceStatus,
      ),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Class Attendance"
        title={
          workspace.unitName
        }
        description={`${workspace.cohortNames} · ${workspace.sessionDate} · ${shortTime(
          workspace.startsAt,
        )}–${shortTime(
          workspace.endsAt,
        )}`}
        icon={CalendarCheck2}
        actions={
          <div className="flex flex-wrap gap-2">
            {workspace.sessionStatus ===
            'completed' ? (
              <ReopenAttendanceButton
                sessionId={
                  sessionId
                }
              />
            ) : null}

            <Link
              href="/attendance-clinical/class-attendance"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <ArrowLeft
                className="size-3.5"
                aria-hidden="true"
              />
              Attendance
            </Link>
          </div>
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
          Trainer: {
            workspace.trainerName
          }
        </Badge>

        <Badge variant="neutral">
          Present {
            summary.present
          }
        </Badge>

        <Badge variant="neutral">
          Absent {
            summary.absent
          }
        </Badge>

        {summary.unmarked >
        0 ? (
          <Badge variant="warning">
            Unmarked {
              summary.unmarked
            }
          </Badge>
        ) : null}
      </div>

      {workspace.sessionStatus ===
      'completed' ? (
        <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
          <p className="text-[11px] leading-5 text-text-secondary">
            Reopening makes the session
            editable again for the assigned
            trainer. The reopen action is
            recorded in attendance history.
          </p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(8rem,.7fr)_8rem_minmax(8rem,.8fr)] md:gap-3">
          <span>Student</span>
          <span>Cohort</span>
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
                className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(8rem,.7fr)_8rem_minmax(8rem,.8fr)] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">
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

                <p className="text-[10px] text-text-secondary">
                  {
                    student.cohortName
                  }
                </p>

                <Badge
                  variant={
                    classAttendanceStatusVariant(
                      student.attendanceStatus,
                    )
                  }
                >
                  {student.attendanceStatus ===
                  'present'
                    ? 'Present'
                    : student.attendanceStatus ===
                        'absent'
                      ? 'Absent'
                      : 'Unmarked'}
                </Badge>

                <p className="text-[10px] leading-4 text-text-muted">
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
