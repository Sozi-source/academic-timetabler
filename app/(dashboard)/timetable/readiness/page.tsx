import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ClipboardCheck, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { ReadinessDashboard } from '@/features/scheduling-readiness/readiness-dashboard';
import { getSchedulingReadiness } from '@/features/scheduling-readiness/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Timetable Readiness',
  description: 'Validate units, allocations, rooms and workloads before timetable generation.',
};

export default async function TimetableReadinessPage({ searchParams }: { searchParams: Promise<{ academicPeriodId?: string }> }) {
  await requireHodAccess();
  const [periods, params] = await Promise.all([getAcademicPeriods(), searchParams]);
  const selectable = periods.filter(
    (period) =>
      period.academicYear.status === 'active' &&
      ['planned', 'active'].includes(period.status),
  );
  const selectedId = params.academicPeriodId ?? selectable.find((period) => period.status === 'active')?.id ?? selectable[0]?.id;

  if (!selectedId) {
    redirect('/timetable/academic-periods');
  }

  const readiness = await getSchedulingReadiness(selectedId);
  if (!readiness) redirect('/timetable/academic-periods');

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Step 1 of 4"
        title="Check your setup"
        description="Fix only the items marked as missing before generating the timetable."
        icon={ClipboardCheck}
        backHref="/dashboard"
        backLabel="Dashboard"
        context={<div className="inline-flex items-center gap-2 text-sm text-text-muted"><ClipboardCheck className="size-4" aria-hidden="true" />{readiness.academicPeriodName}</div>}
        actions={<form method="get"><label className="sr-only" htmlFor="academicPeriodId">Academic Period</label><select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId} className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"><option value={selectedId}>{readiness.academicPeriodName}</option>{selectable.filter((period) => period.id !== selectedId).map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select><button type="submit" className="ml-2 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Sparkles className="size-4" aria-hidden="true" />Assess</button></form>}
      />
      <ReadinessDashboard readiness={readiness} />
    </div>
  );
}
