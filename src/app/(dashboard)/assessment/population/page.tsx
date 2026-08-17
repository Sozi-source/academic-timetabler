import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessments } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentPopulationPage() {
  await requireHodAccess();
  const markbooks = await getAssessments();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Assessment" title="Assessment population" description="Expected students for each unit markbook." icon={UsersRound} context={<Badge variant="neutral">{markbooks.length} units</Badge>} />
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {markbooks.map((assessment) => (
            <Link key={assessment.id} href={`/assessment/population/${assessment.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-subtle/60">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-text-primary">{assessment.unit?.code ?? 'Unit'} · {assessment.unit?.name ?? 'Unit markbook'}</p>
                <p className="mt-0.5 truncate text-[0.6875rem] text-text-muted">{assessment.academic_period?.name ?? 'Period'} · All registered cohorts</p>
              </div>
              <Badge variant="neutral">{assessment.population?.[0]?.count ?? 0} students</Badge>
            </Link>
          ))}
        </div>
        {markbooks.length === 0 ? <div className="px-4 py-8 text-center text-xs text-text-muted">Create a unit markbook first.</div> : null}
      </Card>
    </div>
  );
}
