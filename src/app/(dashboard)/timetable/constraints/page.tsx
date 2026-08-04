import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { ConstraintWorkspace } from '@/features/scheduling-constraints/constraint-workspace';
import { getSchedulingConstraintData } from '@/features/scheduling-constraints/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Scheduling Constraints', description: 'Manage institutional, trainer, room and cohort scheduling rules.' };

export default async function ConstraintsPage({ searchParams }: { searchParams: Promise<{ academicPeriodId?: string }> }) {
  await requireHodAccess();
  const periods = (await getAcademicPeriods()).filter((period) => period.status === 'active' || period.status === 'planned');
  const params = await searchParams;
  const selectedId = params.academicPeriodId ?? periods.find((period) => period.status === 'active')?.id ?? periods[0]?.id ?? null;
  const data = selectedId ? await getSchedulingConstraintData(selectedId) : null;
  return <div className="space-y-6"><PageHeader eyebrow="Enterprise scheduling" title="Availability and constraints" description="Define hard restrictions and soft preferences used during readiness assessment, timetable generation and manual editing." actions={<div className="inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4"/> Constraint control</div>}/>
    <form method="get" className="rounded-2xl border border-border bg-surface p-4 shadow-sm"><label className="text-sm font-semibold text-text-primary" htmlFor="academicPeriodId">Academic Period</label><div className="mt-2 flex gap-2"><select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''} className="h-11 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm">{periods.map((period)=><option key={period.id} value={period.id}>{period.code} — {period.name}</option>)}</select><button className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white">Load</button></div></form>
    {selectedId && data ? <ConstraintWorkspace academicPeriodId={selectedId} data={data}/> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted">No active or planned Academic Period is available.</div>}
  </div>;
}
