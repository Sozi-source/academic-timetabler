import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessments, getAssessmentSetupOptions } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { AdminDepartmentMarksEntryControl } from '@/features/assessment/admin-department-marks-entry-control';

export default async function AssessmentsPage() {
  await requireHodAccess();
  const [assessments, options] = await Promise.all([getAssessments(), getAssessmentSetupOptions()]);
  const activePeriod = options.periods.find((period) => period.status === 'active') ?? null;
  const markbooks = assessments.filter((assessment) => assessment.title === 'Unit Markbook');
  const openMarkbooks = markbooks.filter((assessment) => assessment.trainer_entry_open);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Unit markbooks & grading oversight"
        description="Monitor marks submission progress across all unit markbooks."
        icon={ListChecks}
        backHref="/assessment"
        backLabel="Assessments"
        context={<Badge variant="neutral">{markbooks.length} units</Badge>}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activePeriod ? (
              <AdminDepartmentMarksEntryControl
                periodId={activePeriod.id}
                isOpen={openMarkbooks.length > 0}
                openCount={openMarkbooks.length}
                totalCount={markbooks.length}
              />
            ) : null}
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 p-3 md:hidden">
          {markbooks.map((assessment) => {
            return (
              <article key={assessment.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{assessment.unit?.code ?? '—'}</p>
                    <p className="text-xs text-text-secondary">{assessment.unit?.name ?? ''}</p>
                    <p className="mt-1 text-xs text-text-muted">{assessment.academic_period?.name ?? '—'}</p>
                  </div>
                  <Badge variant={assessment.trainer_entry_open ? 'success' : 'neutral'}>{assessment.trainer_entry_open ? 'Open' : 'Locked'}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-text-secondary">{assessment.population?.[0]?.count ?? 0} students</span>
                </div>
                <div className="border-t border-border pt-2 text-xs">
                  <p className="mb-1 font-semibold text-text-secondary">Assigned trainers</p>
                  {assessment.assigned_trainers?.length ? assessment.assigned_trainers.map((trainer) => (
                    <p key={trainer.id} className="break-words text-text-primary">{trainer.name}</p>
                  )) : <span className="text-text-muted">No trainer assigned</span>}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Link href={`/assessment/marks/${assessment.id}`} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-center text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary">Open marksheet</Link>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Period</th>
                <th className="px-3 py-2.5 font-semibold">Population</th>
                <th className="px-3 py-2.5 font-semibold">Assigned trainers</th>
                <th className="px-3 py-2.5 font-semibold">Trainer entry</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {markbooks.map((assessment) => {
                return (
                  <tr key={assessment.id}>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">
                      {assessment.unit?.code ?? '—'}
                      <div className="mt-0.5 text-[0.6875rem] font-normal text-text-muted">{assessment.unit?.name ?? ''}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{assessment.academic_period?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{assessment.population?.[0]?.count ?? 0}</td>
                    <td className="max-w-72 px-3 py-2.5">
                      {assessment.assigned_trainers?.length ? (
                        <ul className="space-y-1">
                          {assessment.assigned_trainers.map((trainer) => (
                            <li key={trainer.id} className="text-text-primary">
                              <span className="font-semibold">{trainer.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-text-muted">No trainer assigned</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <Badge variant={assessment.trainer_entry_open ? 'success' : 'neutral'}>{assessment.trainer_entry_open ? 'Open' : 'Locked'}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/assessment/marks/${assessment.id}`} className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 font-semibold text-text-secondary hover:border-primary hover:text-primary">Open marksheet</Link>
                      </div>
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
