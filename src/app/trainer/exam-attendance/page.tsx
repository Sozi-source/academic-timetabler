import { CheckCircle2, ClipboardCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getTrainerAttendanceUnits } from '@/features/trainer-exam-attendance/queries';

export default async function TrainerExamAttendancePage() {
  const units = await getTrainerAttendanceUnits();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Exam attendance</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-text-primary">My units</h1>
        <p className="mt-1 text-sm text-text-muted">
          Record only students who did not sign the physical attendance sheet.
        </p>
      </div>

      {units.length === 0 ? (
        <Card className="p-5 text-sm text-text-muted">
          No Unit Markbooks are currently assigned to you.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {units.map((unit) => {
            const locked = Boolean(unit.examMarksFinalizedAt);
            const complete = Boolean(unit.attendanceFinalizedAt);

            return (
              <Link key={unit.assessmentId} href={`/trainer/exam-attendance/${unit.assessmentId}`}>
                <Card className="h-full p-4 transition hover:border-primary/40 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-muted">{unit.unitCode}</p>
                      <h2 className="mt-0.5 truncate text-sm font-bold text-text-primary">{unit.unitName}</h2>
                      <p className="mt-1 text-xs text-text-muted">{unit.academicPeriodName}</p>
                    </div>
                    <Badge variant={locked || complete ? 'success' : 'neutral'}>
                      {locked ? 'Locked' : complete ? 'Confirmed' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound className="size-3.5" />
                      {unit.expectedStudents} expected
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ClipboardCheck className="size-3.5" />
                      {unit.absentStudents} absent
                    </span>
                    {complete ? <CheckCircle2 className="ml-auto size-4 text-success" /> : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
