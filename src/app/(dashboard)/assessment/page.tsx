import { BookOpenCheck, ClipboardList, FileCheck2, ListChecks, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getAssessmentOverview, getAssessments } from '@/features/assessment/queries';

export default async function AssessmentModulePage() {
  await requireHodAccess();
  const [overview, markbooks] = await Promise.all([getAssessmentOverview(), getAssessments()]);
  const recent = markbooks.slice(0, 6);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Assessment" title="Academic performance" description="One progressive markbook per unit." icon={ClipboardList} context={<Badge variant="neutral">{overview.total} units</Badge>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Unit markbooks" value={String(overview.total)} description="Configured" icon={ListChecks} />
        <MetricCard label="CAT complete" value={String(overview.cats)} description="Marks committed" icon={BookOpenCheck} />
        <MetricCard label="Final complete" value={String(overview.exams)} description="Exam marks committed" icon={FileCheck2} />
        <MetricCard label="In progress" value={String(overview.open + overview.draft)} description="Working markbooks" icon={ClipboardList} />
        <MetricCard label="Population" value={String(overview.candidates)} description="Expected entries" icon={UsersRound} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">Recent unit markbooks</h2>
          <Link href="/assessment/assessments" className="text-xs font-semibold text-primary hover:underline">Manage</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">No unit markbooks configured.</div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((assessment) => (
              <Link key={assessment.id} href={`/assessment/marks/${assessment.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-subtle/60">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-text-primary">{assessment.unit?.code ?? 'Unit'} · {assessment.unit?.name ?? 'Unit markbook'}</p>
                  <p className="mt-0.5 truncate text-[0.6875rem] text-text-muted">{assessment.academic_period?.name ?? 'Period'}</p>
                </div>
                <Badge variant={assessment.exam_marks_finalized_at ? 'success' : assessment.cat_marks_finalized_at ? 'institutional' : 'neutral'}>
                  {assessment.exam_marks_finalized_at ? 'Final complete' : assessment.cat_marks_finalized_at ? 'CAT complete' : 'In progress'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
