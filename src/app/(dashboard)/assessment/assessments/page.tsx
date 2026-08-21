import { ClipboardPlus, ListChecks } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { createAssessmentAction } from '@/features/assessment/actions';
import { getAssessments, getAssessmentSetupOptions } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { MarkbookDeleteButton } from '@/features/assessment/markbook-delete-button';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireHodAccess();
  const [params, assessments, options] = await Promise.all([searchParams, getAssessments(), getAssessmentSetupOptions()]);
  const error = typeof params.error === 'string' ? params.error : '';
  const activePeriod = options.periods.find((period) => period.status === 'active') ?? null;
  const markbooks = assessments.filter((assessment) => assessment.title === 'Unit Markbook');
  const errorText = error === 'duplicate' ? 'This unit markbook already exists.' : error ? 'Unit markbook could not be saved.' : '';

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Assessment" title="Unit markbooks" description="One workbook per unit for CAT and final exam marks." icon={ListChecks} context={<Badge variant="neutral">{markbooks.length} units</Badge>} />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2"><ClipboardPlus className="size-4 text-primary" /><h2 className="text-sm font-bold text-text-primary">New unit markbook</h2></div>
        {errorText ? <p className="mb-3 rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">{errorText}</p> : null}
        <form action={createAssessmentAction} className="grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto]">
          <div className="space-y-1 text-xs font-semibold text-text-secondary">
            <span>Academic period</span>
            {activePeriod ? <><input type="hidden" name="academicPeriodId" value={activePeriod.id} /><div className="flex h-9 items-center rounded-lg border border-border bg-surface-subtle px-2.5 text-xs font-semibold text-text-primary">{activePeriod.name}</div></> : <div className="flex h-9 items-center rounded-lg border border-danger/30 bg-danger-subtle px-2.5 text-xs font-semibold text-danger">No active academic period</div>}
          </div>
          <label className="space-y-1 text-xs font-semibold text-text-secondary">Unit<select name="unitId" required disabled={!activePeriod} className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60"><option value="">Select unit</option>{options.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.programmeCode} · {unit.code} · {unit.name}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-text-secondary">Exam date <span className="font-normal text-text-muted">(optional)</span><input name="assessmentDate" type="date" className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary" /></label>
          <div className="flex items-end"><button type="submit" disabled={!activePeriod} className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">Create markbook</button></div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5 font-semibold">Unit</th><th className="px-3 py-2.5 font-semibold">Period</th><th className="px-3 py-2.5 font-semibold">Population</th><th className="px-3 py-2.5 font-semibold">Stage</th><th className="px-3 py-2.5" />          <th className="px-4 py-3 text-right">Actions</th>
</tr></thead><tbody className="divide-y divide-border">{markbooks.map((assessment) => <tr key={assessment.id}><td className="px-4 py-2.5 font-semibold text-text-primary">{assessment.unit?.code ?? '—'}<div className="mt-0.5 text-[0.6875rem] font-normal text-text-muted">{assessment.unit?.name ?? ''}</div></td><td className="px-3 py-2.5 text-text-secondary">{assessment.academic_period?.name ?? '—'}</td><td className="px-3 py-2.5 font-semibold text-text-primary">{assessment.population?.[0]?.count ?? 0}</td><td className="px-3 py-2.5"><Badge variant={assessment.exam_marks_finalized_at ? 'success' : 'neutral'}>{assessment.exam_marks_finalized_at ? 'Final complete' : assessment.attendance_finalized_at ? 'Exam marking' : assessment.cat_marks_finalized_at ? 'CAT complete' : 'CAT marking'}</Badge></td><td className="px-3 py-2.5 text-right"><Link href={`/assessment/marks/${assessment.id}`} className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 font-semibold text-text-secondary hover:border-primary hover:text-primary">Open workflow</Link></td>          <td className="px-4 py-3 text-right">
            <MarkbookDeleteButton
              assessmentId={assessment.id}
            />
          </td>
</tr>)}</tbody></table></div>
        {markbooks.length === 0 ? <div className="px-4 py-8 text-center text-xs text-text-muted">No unit markbooks configured.</div> : null}
      </Card>
    </div>
  );
}
