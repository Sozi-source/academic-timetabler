import { BarChart3 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessments } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentAnalysisPage() {
  await requireHodAccess();
  const markbooks = await getAssessments();
  const ready = markbooks.filter((assessment) => assessment.cat_marks_finalized_at || assessment.exam_marks_finalized_at);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Analysis"
        description="CAT and final exam performance from each unit markbook."
        icon={BarChart3}
        context={<Badge variant="neutral">{ready.length} ready</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Period</th>
                <th className="px-3 py-2.5 font-semibold">Population</th>
                <th className="px-3 py-2.5 font-semibold">Available analysis</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {markbooks.map((assessment) => {
                const catReady = Boolean(assessment.cat_marks_finalized_at);
                const examReady = Boolean(assessment.exam_marks_finalized_at);
                const canAnalyse = catReady || examReady;
                return (
                  <tr key={assessment.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-text-primary">{assessment.unit?.code ?? 'Unit'} · {assessment.unit?.name ?? 'Unit markbook'}</p>
                      <p className="mt-0.5 text-[0.625rem] text-text-muted">Unit Markbook</p>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{assessment.academic_period?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{assessment.population?.[0]?.count ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={catReady ? 'institutional' : 'neutral'}>{catReady ? 'CAT ready' : 'CAT pending'}</Badge>
                        <Badge variant={examReady ? 'success' : 'neutral'}>{examReady ? 'Exam ready' : 'Exam pending'}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canAnalyse ? (
                        <Link href={`/assessment/analysis/${assessment.id}`} className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 font-semibold text-text-secondary hover:border-primary hover:text-primary">Analyse</Link>
                      ) : (
                        <span className="text-[0.625rem] font-semibold text-text-muted">Marks pending</span>
                      )}
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
