import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpenCheck, Download, LogOut } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { studentPortalLogout } from '@/features/student-portal/actions';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { StudentUnitRegistrationForm } from '@/features/student-portal/unit-registration-form';

function stageLabel(periodNumber: number) {
  const year = Math.ceil(periodNumber / 2);
  const semester = periodNumber % 2 === 0 ? 2 : 1;
  return `Y${year}S${semester}`;
}

export default async function StudentUnitRegistrationPage() {
  const session = await getStudentPortalSession();
  if (!session) redirect('/student/login');

  const context = await getStudentPortalRegistrationContext(session.studentId);
  if (!context) {
    return <main className="p-6"><EmptyState icon={BookOpenCheck} title="Registration unavailable" description="Contact the department." /></main>;
  }

  const locked = context.submission?.status === 'submitted' || context.submission?.status === 'verified';

  return (
    <main className="min-h-screen bg-surface-subtle">
      <div className="border-t-4 border-accent bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-bold text-text-primary">Academic Management System</p>
            <p className="text-[0.6875rem] text-text-muted">Student registration</p>
          </div>
          <form action={studentPortalLogout}>
            <Button type="submit" variant="ghost" size="sm"><LogOut className="size-4" /> Sign out</Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-5 py-5">
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-text-primary">{context.student.fullName}</p>
              <p className="mt-0.5 text-xs text-text-muted">{context.student.admissionNumber} · {context.student.cohortName} · {stageLabel(context.student.academicPeriodNumber)}</p>
            </div>
            {context.submission ? (
              <Badge variant={context.submission.status === 'verified' ? 'success' : context.submission.status === 'returned' ? 'warning' : 'institutional'}>
                {context.submission.status}
              </Badge>
            ) : null}
          </div>
        </Card>

        {!context.period ? (
          <EmptyState icon={BookOpenCheck} title="Registration closed" description="No active academic period." />
        ) : locked ? (
          <Card className="px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-bold text-text-primary">Registration {context.submission?.status}</h1>
                <p className="mt-1 text-xs text-text-muted">{context.period.name} · {context.units.filter((unit) => unit.selected).length} units</p>
                {context.submission?.verificationNote ? <p className="mt-2 text-xs text-text-muted">{context.submission.verificationNote}</p> : null}
              </div>
              <Button asChild size="sm">
                <Link href="/api/student/unit-registration/form"><Download className="size-4" /> Download form</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-bold text-text-primary">{context.period.name}</h1>
                <p className="mt-0.5 text-xs text-text-muted">Confirm the units you are taking.</p>
              </div>
              {context.submission?.status === 'returned' ? <Badge variant="warning">Returned for correction</Badge> : null}
            </div>
            {context.submission?.verificationNote ? <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-text-primary">{context.submission.verificationNote}</p> : null}
            <StudentUnitRegistrationForm academicPeriodId={context.period.id} units={context.units} />
          </Card>
        )}
      </div>
    </main>
  );
}
