import {
  BookOpenCheck,
} from 'lucide-react';
import {
  redirect,
} from 'next/navigation';

import {
  StudentPortalShell,
} from '@/components/student/student-portal-shell';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  EmptyState,
} from '@/components/ui/empty-state';
import {
  activeStudentUnits,
} from '@/features/student-portal/domain';
import {
  getActiveStudentPortalPeriod,
  getStudentPortalIdentity,
  getStudentPortalUnits,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentUnitsPage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    period,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getActiveStudentPortalPeriod(),
    ]);

  if (!student) {
    redirect(
      '/student/login',
    );
  }

  const units =
    period
      ? activeStudentUnits(
          await getStudentPortalUnits(
            session.studentId,
            period.id,
          ),
        )
      : [];

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-xl font-bold text-text-primary">
              My Units
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              {
                period
                  ?.name ??
                'No active academic period'
              }
            </p>
          </div>

          <Badge variant="neutral">
            {
              units.length
            } units
          </Badge>
        </div>

        {units.length ===
        0 ? (
          <EmptyState
            icon={
              BookOpenCheck
            }
            title="No registered units"
            description="No units are registered for this period."
          />
        ) : (
          <Card className="divide-y divide-border">
            {units.map(
              (
                unit,
                index,
              ) => (
                <div
                  key={
                    unit.registrationId
                  }
                  className="grid gap-2 px-4 py-3.5 sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="text-[10px] font-semibold text-text-muted">
                    {String(
                      index +
                        1,
                    ).padStart(
                      2,
                      '0',
                    )}
                  </span>

                  <span className="text-[10px] font-bold text-text-muted">
                    {
                      unit.unitCode
                    }
                  </span>

                  <p className="text-xs font-semibold text-text-primary">
                    {
                      unit.unitName
                    }
                  </p>

                  <Badge variant="success">
                    Registered
                  </Badge>
                </div>
              ),
            )}
          </Card>
        )}
      </div>
    </StudentPortalShell>
  );
}
