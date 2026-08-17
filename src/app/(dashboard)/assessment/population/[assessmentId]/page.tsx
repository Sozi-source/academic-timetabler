import { RefreshCw, UsersRound } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { refreshAssessmentPopulationAction } from '@/features/assessment/actions';
import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';

type Params = Promise<{ assessmentId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AssessmentPopulationDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await requireHodAccess();
  const [{ assessmentId }, query] = await Promise.all([params, searchParams]);
  const [assessment, population] = await Promise.all([getAssessmentById(assessmentId), getAssessmentPopulation(assessmentId)]);
  if (!assessment) notFound();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Assessment population" title={assessment.title} description={`${assessment.unit?.code ?? 'Unit'} · ${assessment.academic_period?.name ?? 'Academic period'}`} icon={UsersRound} context={<div className="flex items-center gap-2"><Badge variant="neutral">{population.length} expected</Badge><Badge variant={assessment.assessment_type === 'exam' ? 'institutional' : 'neutral'}>{assessment.assessment_type.toUpperCase()}</Badge></div>} actions={assessment.status === 'draft' ? <form action={refreshAssessmentPopulationAction}><input type="hidden" name="assessmentId" value={assessment.id} /><button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"><RefreshCw className="size-3.5" />Refresh population</button></form> : undefined} />

      {query.refreshed ? <p className="rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success">Population refreshed.</p> : null}
      {query.error ? <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">Population could not be refreshed.</p> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5 font-semibold">Student</th><th className="px-3 py-2.5 font-semibold">Admission no.</th><th className="px-3 py-2.5 font-semibold">Cohort</th><th className="px-3 py-2.5 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-border">{population.map((row) => <tr key={row.id}><td className="px-4 py-2.5 font-semibold text-text-primary">{row.student?.full_name ?? 'Unknown student'}</td><td className="px-3 py-2.5 text-text-secondary">{row.student?.admission_number ?? '—'}</td><td className="px-3 py-2.5 text-text-secondary">{row.cohort?.name ?? '—'}</td><td className="px-3 py-2.5"><Badge variant="success">{row.population_status}</Badge></td></tr>)}</tbody></table></div>
        {population.length === 0 ? <div className="px-4 py-8 text-center text-xs text-text-muted">No verified registrations match this assessment.</div> : null}
      </Card>
    </div>
  );
}
