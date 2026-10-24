import {
  BookOpenCheck,
  CheckCircle2,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { activeStudentUnits } from '@/features/student-portal/domain';
import {
  getActiveStudentPortalPeriod,
  getStudentPortalIdentity,
  getStudentPortalUnits,
} from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';

export default async function StudentUnitsPage() {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const [student, period] = await Promise.all([
    getStudentPortalIdentity(session.studentId),
    getActiveStudentPortalPeriod(),
  ]);

  if (!student) {
    redirect('/student/login');
  }

  const units = period
    ? activeStudentUnits(
        await getStudentPortalUnits(
          session.studentId,
          period.id,
        ),
      )
    : [];

  return (
    <StudentPortalShell student={student}>
      <div className="space-y-4">
        {/* Header Banner */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
                <BookOpenCheck className="size-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Curriculum
              </p>
            </div>
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              My Units
            </h1>
            <p className="text-xs text-text-muted">
              {period?.name ?? 'No active academic period'} · {student.programmeName}
            </p>
          </div>

          <Badge variant="neutral" className="px-3 py-1 font-mono text-xs">
            {units.length} unit{units.length === 1 ? '' : 's'}
          </Badge>
        </section>

        {units.length === 0 ? (
          <EmptyState
            icon={BookOpenCheck}
            title="No registered units"
            description="No units are registered for this period. Please complete unit registration."
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xs">
            <div className="grid grid-cols-[2.5rem_5.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-surface-subtle/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              <span>#</span>
              <span>Code</span>
              <span>Unit Title</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-border">
              {units.map((unit, index) => (
                <div
                  key={unit.registrationId}
                  className="grid grid-cols-[2.5rem_5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-xs transition-colors hover:bg-primary-subtle/10"
                >
                  <span className="font-mono text-[11px] font-medium text-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="font-mono text-[11px] font-bold text-text-primary">
                    {unit.unitCode}
                  </span>

                  <p className="font-semibold text-text-primary truncate min-w-0 pr-2">
                    {unit.unitName}
                  </p>

                  <div className="flex justify-end">
                    <Badge variant="success" className="gap-1 text-[10px] py-0.5">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Registered
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </StudentPortalShell>
  );
}
