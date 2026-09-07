import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, CheckCircle2, Download, FileCheck2, TriangleAlert, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { ReportingSyncDialog } from '@/features/student-reporting-sync/reporting-sync-dialog';
import { getUnitRegistrationContext } from '@/features/student-unit-registration/queries';
import { BatchRegistrationLink } from '@/features/student-unit-registration/batch-registration-link';
import { StudentUnitRegistrationTable } from '@/features/student-unit-registration/student-unit-registration-table';

export default async function UnitRegistrationPage() {
  await requireHodAccess();
  const context = await getUnitRegistrationContext();

  if (!context.period) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Registration"
          title="Unit Registration"
          description="Register student unit selections for active academic periods."
          icon={BookOpenCheck}
          actions={
            <Link
              href="/students"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Students
            </Link>
          }
        />
        <EmptyState icon={BookOpenCheck} title="No active academic period" description="Activate an academic period first." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Period Badge & Batch Links */}
      <PageHeader
        eyebrow="Registration"
        title="Unit Registration"
        description="Batch register cohorts or manage individual student unit offerings."
        icon={BookOpenCheck}
        context={<Badge variant="institutional">{context.period.name}</Badge>}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/students"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Students
            </Link>
            <ReportingSyncDialog />
            <Link
              href="/students/unit-registration/stages"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              Stage Setup
            </Link>
            <BatchRegistrationLink />
          </div>
        )}
      />

      {/* Summary Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="Active Students" value={String(context.students.length)} description="Admitted & Active" icon={UsersRound} />
        <MetricCard label="Submitted" value={String(context.submittedCount)} description="Awaiting review" icon={FileCheck2} />
        <MetricCard label="Verified Roster" value={String(context.verifiedCount)} description="Authoritative registration" icon={CheckCircle2} />
        <MetricCard label="Exceptions" value={String(context.exceptionCount)} description="Unit adjustments" icon={TriangleAlert} />
      </div>

      {/* Interactive Search, Filter & Paginated Table */}
      {context.students.length === 0 ? (
        <EmptyState icon={UsersRound} title="No active students" description="Import students before registration." />
      ) : (
        <StudentUnitRegistrationTable
          students={context.students}
          academicPeriodId={context.period.id}
        />
      )}
    </div>
  );
}
