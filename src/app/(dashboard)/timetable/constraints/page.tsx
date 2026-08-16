import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
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
  return <div className="space-y-5"><PageHeader eyebrow="Enterprise scheduling" title="Availability and constraints" description="Define hard restrictions and soft preferences for scheduling." actions={<Badge variant="primary"><ShieldCheck className="size-3.5"/> Constraint control</Badge>}/>
    <Card className="p-4"><form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 space-y-1.5"><span className="text-sm font-medium text-text-primary">Academic Period</span><Select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''}>{periods.map((period)=><option key={period.id} value={period.id}>{period.code} — {period.name}</option>)}</Select></label><Button type="submit">Load</Button></form></Card>
    {selectedId && data ? <ConstraintWorkspace academicPeriodId={selectedId} data={data}/> : <EmptyState icon={ShieldCheck} title="No constraints to show" description="No active or planned Academic Period is available." />}
  </div>;
}
