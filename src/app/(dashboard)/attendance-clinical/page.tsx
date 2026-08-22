import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  Stethoscope,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
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
  getDepartmentAttendanceOverview,
} from '@/features/operations/queries';

export default async function AttendanceClinicalPage() {
  await requireHodAccess();

  const sessions =
    await getDepartmentAttendanceOverview(
      100,
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

  const unmarked =
    sessions.reduce(
      (
        total,
        session,
      ) =>
        total +
        session.unmarkedCount,
      0,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Department"
        title="Attendance & Clinical"
        description="Class attendance oversight and clinical workflow foundation."
        icon={Stethoscope}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Completed"
          value={String(
            completed,
          )}
          description="Recent class sessions"
          icon={CalendarCheck2}
        />

        <MetricCard
          label="Open"
          value={String(
            open,
          )}
          description="Still editable"
          icon={ClipboardList}
        />

        <MetricCard
          label="Unmarked"
          value={String(
            unmarked,
          )}
          description="Across open sessions"
          icon={ClipboardList}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/attendance-clinical/class-attendance"
        >
          <Card className="h-full p-5 transition hover:border-border-strong hover:bg-surface-subtle/40">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                <CalendarCheck2
                  className="size-5"
                  aria-hidden="true"
                />
              </span>

              <Badge variant="success">
                Active
              </Badge>
            </div>

            <h2 className="mt-4 text-sm font-bold text-text-primary">
              Class attendance
            </h2>

            <p className="mt-1 text-xs leading-5 text-text-muted">
              Review Present / Absent records, open sessions and controlled corrections.
            </p>
          </Card>
        </Link>

        <Link
          href="/attendance-clinical/class-attendance/analytics"
        >
          <Card className="h-full p-5 transition hover:border-border-strong hover:bg-surface-subtle/40">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                <BarChart3
                  className="size-5"
                  aria-hidden="true"
                />
              </span>

              <Badge variant="success">
                Active
              </Badge>
            </div>

            <h2 className="mt-4 text-sm font-bold text-text-primary">
              Attendance analytics
            </h2>

            <p className="mt-1 text-xs leading-5 text-text-muted">
              Review active-period attendance rates and export student detail.
            </p>
          </Card>
        </Link>

        <Card className="h-full p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-subtle text-text-muted">
              <Stethoscope
                className="size-5"
                aria-hidden="true"
              />
            </span>

            <Badge variant="neutral">
              Later
            </Badge>
          </div>

          <h2 className="mt-4 text-sm font-bold text-text-primary">
            Clinical progression
          </h2>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Clinical rotations and progression remain outside the current production-testing scope.
          </p>
        </Card>
      </section>
    </div>
  );
}
