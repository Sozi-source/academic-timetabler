import {
  ArrowLeft,
  ClipboardCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  AttendanceOversightActions,
} from '@/features/operations/attendance-oversight-actions';
import {
  shortOperationalTime,
} from '@/features/operations/domain';
import {
  getAttendanceOversight,
} from '@/features/operations/queries';

export default async function AttendanceOversightPage() {
  await requireHodAccess();

  const sessions =
    await getAttendanceOversight(
      150,
    );

  const completed =
    sessions.filter(
      (session) =>
        session.sessionStatus ===
        'completed',
    ).length;

  const open =
    sessions.filter(
      (session) =>
        session.sessionStatus ===
        'open',
    ).length;

  const incomplete =
    sessions.filter(
      (session) =>
        session.unmarkedCount >
        0,
    ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations & QA"
        title="Attendance oversight"
        description="Department class-attendance records."
        icon={ClipboardCheck}
        actions={
          <Link
            href="/operations"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Operations
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Open"
          value={String(
            open,
          )}
          description="Still editable"
          icon={ClipboardCheck}
        />

        <MetricCard
          label="Incomplete"
          value={String(
            incomplete,
          )}
          description="Students still unmarked"
          icon={ClipboardCheck}
        />

        <MetricCard
          label="Completed"
          value={String(
            completed,
          )}
          description="Read only"
          icon={ClipboardCheck}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        {sessions.length ===
        0 ? (
          <p className="px-4 py-8 text-center text-xs text-text-muted">
            No class attendance has been
            recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map(
              (
                session,
              ) => (
                <article
                  key={
                    session.classSessionId
                  }
                  className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_10rem_9rem_10rem_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        session.unitName
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {
                        session.cohortName
                      }
                      {' · '}
                      {
                        session.sessionDate
                      }
                      {' · '}
                      {shortOperationalTime(
                        session.startsAt,
                      )}
                      –
                      {shortOperationalTime(
                        session.endsAt,
                      )}
                    </p>
                  </div>

                  <p className="text-[10px] text-text-secondary">
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
                    {session.sessionStatus ===
                    'completed'
                      ? 'Completed'
                      : 'Open'}
                  </Badge>

                  <p className="text-[10px] text-text-muted">
                    P {
                      session.presentCount
                    }
                    {' · '}
                    A {
                      session.absentCount
                    }
                    {' · '}
                    U {
                      session.unmarkedCount
                    }
                  </p>

                  <div className="lg:justify-self-end">
                    {session.sessionStatus ===
                    'completed' ? (
                      <AttendanceOversightActions
                        sessionId={
                          session.classSessionId
                        }
                      />
                    ) : (
                      <Badge
                        variant={
                          session.unmarkedCount >
                          0
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {session.unmarkedCount >
                        0
                          ? `${session.unmarkedCount} unmarked`
                          : 'Ready to complete'}
                      </Badge>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
