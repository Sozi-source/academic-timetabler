import { FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessments } from '@/features/assessment/queries';
import { getUnitMarkbookStage, unitMarkbookStageLabel } from '@/features/assessment/marks/workflow';
import { requireHodAccess } from '@/features/auth/authorization';

function stageFor(assessment: Awaited<ReturnType<typeof getAssessments>>[number]) {
  const stage = getUnitMarkbookStage({
    populationCount: assessment.population?.[0]?.count ?? 0,
    catFinalizedAt: assessment.cat_marks_finalized_at,
    attendanceFinalizedAt: assessment.attendance_finalized_at,
    examFinalizedAt: assessment.exam_marks_finalized_at,
  });
  const variant = stage === 'complete' ? 'success' as const : stage === 'attendance' ? 'institutional' as const : stage === 'exam' ? 'warning' as const : 'neutral' as const;
  return { label: unitMarkbookStageLabel(stage), variant };
}

export default async function AssessmentMarksPage() {
  await requireHodAccess();
  const markbooks = await getAssessments();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Unit markbooks"
        description="One progressive Excel workbook per unit for the whole academic period."
        icon={FileSpreadsheet}
        context={<Badge variant="neutral">{markbooks.length} units</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Period</th>
                <th className="px-3 py-2.5 font-semibold">Population</th>
                <th className="px-3 py-2.5 font-semibold">Stage</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {markbooks.map((assessment) => {
                const stage = stageFor(assessment);
                return (
                  <tr key={assessment.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-text-primary">{assessment.unit?.code ?? 'Unit'} · {assessment.unit?.name ?? 'Unit markbook'}</p>
                      <p className="mt-0.5 text-[0.625rem] text-text-muted">One workbook · cohort worksheets</p>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{assessment.academic_period?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{assessment.population?.[0]?.count ?? 0}</td>
                    <td className="px-3 py-2.5"><Badge variant={stage.variant}>{stage.label}</Badge></td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/assessment/marks/${assessment.id}`} className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 font-semibold text-text-secondary hover:border-primary hover:text-primary">Open markbook</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {markbooks.length === 0 ? <div className="px-4 py-8 text-center text-xs text-text-muted">No unit markbooks configured.</div> : null}
      </Card>
    </div>
  );
}
