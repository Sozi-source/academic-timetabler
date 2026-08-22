import {
  BarChart3,
  CalendarCheck2,
} from 'lucide-react';
import Link from 'next/link';

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
  shortTime,
} from '@/features/class-attendance/domain';
import {
  getDepartmentAttendanceOverview,
} from '@/features/operations/queries';
import {
  ReopenAttendanceButton,
} from '@/features/operations/reopen-attendance-button';

export default async function DepartmentClassAttendancePage() {
  await requireHodAccess();

  const sessions =
    await getDepartmentAttendanceOverview(
      250,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance & Clinical"
        title="Class attendance"
        description="Department attendance oversight."
        icon={CalendarCheck2}
        context={
          <Badge variant="neutral">
            {
              sessions.length
            } sessions
          </Badge>
        }
        actions={
          <Link
            href="/attendance-clinical/class-attendance/analytics"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <BarChart3
              className="size-3.5"
              aria-hidden="true"
            />
            Analytics
          </Link>
        }
      />

      {sessions.length ===
      0 ? (
        <div className="rounded-xl border border-border bg-white px-4 py-8 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No attendance sessions yet
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Trainer attendance will appear after classes are recorded.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted lg:grid lg:grid-cols-[7rem_minmax(0,1.2fr)_minmax(8rem,.8fr)_8rem_8rem_8rem_auto] lg:gap-3">
            <span>Date</span>
            <span>Unit / Cohort</span>
            <span>Trainer</span>
            <span>Status</span>
            <span>Present</span>
            <span>Absent</span>
            <span />
          </div>

          <div className="divide-y divide-border">
            {sessions.map(
              (
                session,
              ) => (
                <article
                  key={
                    session.classSessionId
                  }
                  className="grid gap-3 px-4 py-3 lg:grid-cols-[7rem_minmax(0,1.2fr)_minmax(8rem,.8fr)_8rem_8rem_8rem_auto] lg:items-center"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-text-primary">
                      {
                        session.sessionDate
                      }
                    </p>

                    <p className="mt-0.5 text-[9px] text-text-muted">
                      {shortTime(
                        session.startsAt,
                      )}
                      –
                      {shortTime(
                        session.endsAt,
                      )}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        session.unitName
                      }
                    </p>

                    <p className="mt-0.5 truncate text-[10px] text-text-muted">
                      {
                        session.cohortName
                      }
                      {' · '}
                      {
                        session.academicPeriodName
                      }
                    </p>
                  </div>

                  <p className="truncate text-[11px] text-text-secondary">
                    {
                      session.trainerName
                    }
                  </p>

                  <Badge
                    variant={
                      session.sessionStatus ===
                      'completed'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {
                      session.sessionStatus ===
                      'completed'
                        ? 'Completed'
                        : 'Open'
                    }
                  </Badge>

                  <p className="text-[11px] font-semibold text-text-secondary">
                    {
                      session.presentCount
                    }
                    /
                    {
                      session.rosterCount
                    }
                  </p>

                  <p className="text-[11px] font-semibold text-text-secondary">
                    {
                      session.absentCount
                    }
                    {session.unmarkedCount >
                    0
                      ? ` · ${session.unmarkedCount} unmarked`
                      : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Link
                      href={`/attendance-clinical/class-attendance/${session.classSessionId}`}
                      className="text-[10px] font-semibold text-primary hover:underline"
                    >
                      Review
                    </Link>

                    {session.sessionStatus ===
                    'completed' ? (
                      <ReopenAttendanceButton
                        sessionId={
                          session.classSessionId
                        }
                      />
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
