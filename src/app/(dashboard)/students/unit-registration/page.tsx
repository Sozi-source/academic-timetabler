import Link from 'next/link';
import { BookOpenCheck, CheckCircle2, Download, FileCheck2, TriangleAlert, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { returnStudentUnitRegistration, verifyStudentUnitRegistration } from '@/features/student-unit-registration/actions';
import { getUnitRegistrationContext } from '@/features/student-unit-registration/queries';
import { BatchRegistrationLink } from '@/features/student-unit-registration/batch-registration-link';

function statusBadge(status: string, hasException: boolean) {
  if (status === 'verified') return <Badge variant="success">Verified</Badge>;
  if (status === 'submitted') return <Badge variant={hasException ? 'warning' : 'institutional'}>{hasException ? 'Review' : 'Submitted'}</Badge>;
  if (status === 'returned') return <Badge variant="warning">Returned</Badge>;
  return <Badge variant="neutral">Pending</Badge>;
}

export default async function UnitRegistrationPage() {
  await requireHodAccess();
  const context = await getUnitRegistrationContext();

  if (!context.period) {
    return (

      <div className="space-y-4">
        <PageHeader eyebrow="Registration" title="Unit registration" description="Verify student unit selections." icon={BookOpenCheck} />
        <EmptyState icon={BookOpenCheck} title="No active academic period" description="Activate an academic period first." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <BatchRegistrationLink />
      </div>
      <PageHeader
        eyebrow="Registration"
        title="Unit registration"
        description="Register students directly or verify self-registrations."
        icon={BookOpenCheck}
        context={<Badge variant="institutional">{context.period.name}</Badge>}
        actions={(
          <div className="flex items-center gap-2">
            <Link
              href="/students/unit-registration/stages"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              Stage setup
            </Link>
            <form method="post" action="/api/students/portal-access/issue">
              <Button type="submit" variant="secondary" size="sm"><Download className="size-4" /> Issue access PINs</Button>
            </form>
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Students" value={String(context.students.length)} description="Active / admitted" icon={UsersRound} />
        <MetricCard label="Submitted" value={String(context.submittedCount)} description="Awaiting review" icon={FileCheck2} />
        <MetricCard label="Verified" value={String(context.verifiedCount)} description="Authoritative roster" icon={CheckCircle2} />
        <MetricCard label="Exceptions" value={String(context.exceptionCount)} description="Unit changes" icon={TriangleAlert} />
      </div>

      {context.students.length === 0 ? (
        <EmptyState icon={UsersRound} title="No active students" description="Import students before registration." />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.55fr_1fr_0.7fr_0.7fr_1.25fr] gap-3 border-b border-border bg-surface-subtle px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-wide text-text-muted">
            <span>Student</span>
            <span>Cohort</span>
            <span>Units</span>
            <span>Status</span>
            <span>Review</span>
          </div>
          <div className="divide-y divide-border">
            {context.students.map((student) => (
              <div key={student.id} className="grid grid-cols-[1.55fr_1fr_0.7fr_0.7fr_1.25fr] items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">{student.fullName}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-text-muted">{student.admissionNumber}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-text-primary">{student.cohortName ?? 'No cohort'}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-text-muted">{student.programmeCode}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">{student.selectedUnits}/{student.expectedUnits}</p>
                  <p className="text-[0.6875rem] text-text-muted">selected</p>
                </div>
                <div>{statusBadge(student.status, student.hasException)}</div>
                <div className="min-w-0">
                  {student.status === 'submitted' && student.submissionId ? (
                    <div className="space-y-1.5">
                      {student.hasException && student.exceptionReason ? <p className="truncate text-[0.6875rem] text-warning">{student.exceptionReason}</p> : null}
                      <div className="flex gap-1.5">
                        <form action={verifyStudentUnitRegistration}>
                          <input type="hidden" name="submissionId" value={student.submissionId} />
                          <Button type="submit" size="sm">Verify</Button>
                        </form>
                        <form action={returnStudentUnitRegistration} className="flex min-w-0 gap-1">
                          <input type="hidden" name="submissionId" value={student.submissionId} />
                          <input
                            name="verificationNote"
                            required
                            minLength={3}
                            placeholder="Reason"
                            className="min-w-0 flex-1 rounded-md border border-border px-2 text-[0.6875rem] outline-none focus:border-primary"
                          />
                          <Button type="submit" size="sm" variant="secondary">Return</Button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.6875rem] ${student.status === 'verified' ? 'text-success' : 'text-text-muted'}`}>
                        {student.status === 'verified' ? 'Ready for reports' : student.status === 'returned' ? 'Returned' : 'Not registered'}
                      </span>
                      <Link
                        href={`/students/unit-registration/register/${student.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-border bg-white px-2.5 text-[0.6875rem] font-semibold text-text-secondary hover:bg-surface-subtle"
                      >
                        {student.status === 'verified' ? 'Manage' : 'Register'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
