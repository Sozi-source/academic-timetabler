import { ClipboardPlus, ListChecks, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { createAllAllocatedMarkbooksAction, createAssessmentAction } from '@/features/assessment/actions';
import { getAssessments, getAssessmentSetupOptions } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { MarkbookDeleteButton } from '@/features/assessment/markbook-delete-button';
import { DepartmentTrainerEntryControl } from '@/features/assessment/department-trainer-entry-control';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireHodAccess();
  const [params, assessments, options] = await Promise.all([searchParams, getAssessments(), getAssessmentSetupOptions()]);
  const error = typeof params.error === 'string' ? params.error : '';
  const bulkCreated = typeof params.bulk_created === 'string' ? params.bulk_created : null;
  const bulkFailed = Number(params.bulk_failed ?? 0);
  const activePeriod = options.periods.find((period) => period.status === 'active') ?? null;
  const markbooks = assessments.filter((assessment) => assessment.title === 'Unit Markbook');
  const errorText = error === 'duplicate' ? 'This unit markbook already exists.' : error ? 'Unit markbook could not be saved.' : '';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Unit markbooks"
        icon={ListChecks}
        backHref="/assessment"
        backLabel="Assessments"
        context={<Badge variant="neutral">{markbooks.length} units</Badge>}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DepartmentTrainerEntryControl
              markbooks={markbooks.flatMap((assessment) => (
                assessment.status !== 'closed'
                  && !assessment.exam_marks_finalized_at
                  && (assessment.population?.[0]?.count ?? 0) > 0
                  ? [{ assessmentId: assessment.id, isOpen: assessment.trainer_entry_open }]
                  : []
              ))}
            />
            {activePeriod ? (
              <form action={createAllAllocatedMarkbooksAction}>
                <input type="hidden" name="academicPeriodId" value={activePeriod.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-95 sm:w-auto"
                >
                  <Sparkles className="size-3.5" />
                  Generate all allocated markbooks
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      {bulkCreated !== null ? (
        <p className="rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success">
          Prepared markbooks for this period. {bulkCreated} created{bulkFailed ? ` · ${bulkFailed} failed` : ''}.
        </p>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2"><ClipboardPlus className="size-4 text-primary" /><h2 className="text-sm font-bold text-text-primary">New unit markbook</h2></div>
        {errorText ? <p className="mb-3 rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">{errorText}</p> : null}
        <form action={createAssessmentAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_2fr_1fr_auto]">
          <div className="space-y-1 text-xs font-semibold text-text-secondary">
            <span>Academic period</span>
            {activePeriod ? <><input type="hidden" name="academicPeriodId" value={activePeriod.id} /><div className="flex h-9 items-center rounded-lg border border-border bg-surface-subtle px-2.5 text-xs font-semibold text-text-primary">{activePeriod.name}</div></> : <div className="flex h-9 items-center rounded-lg border border-danger/30 bg-danger-subtle px-2.5 text-xs font-semibold text-danger">No active academic period</div>}
          </div>
          <label className="space-y-1 text-xs font-semibold text-text-secondary">Unit<select name="unitId" required disabled={!activePeriod} className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60"><option value="">Select unit</option>{options.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.programmeCode} · {unit.code} · {unit.name}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-text-secondary">Exam date <span className="font-normal text-text-muted">(optional)</span><input name="assessmentDate" type="date" className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary" /></label>
          <div className="flex items-end"><button type="submit" disabled={!activePeriod} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto">Create markbook</button></div>
        </form>
      </Card>

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
                    <p key={trainer.id} className="break-words text-text-primary">
                      {trainer.name}<span className="text-text-muted"> · {trainer.cohorts.join(', ') || 'No cohort'}</span>
                    </p>
                  )) : <span className="text-text-muted">No trainer assigned</span>}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Link href={`/assessment/marks/${assessment.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-center text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary">Open workflow</Link>
                  <MarkbookDeleteButton assessmentId={assessment.id} />
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
                              <span className="text-text-muted"> · {trainer.cohorts.join(', ') || 'No cohort'}</span>
                              {trainer.email ? <span className="ml-1 text-text-muted">· {trainer.email}</span> : null}
                              {!trainer.email ? <span className="ml-1 text-warning-ink">· email needed</span> : null}
                              {!trainer.accountLinked ? <span className="ml-1 text-danger">· account not linked</span> : null}
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
                        <Link href={`/assessment/marks/${assessment.id}`} className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 font-semibold text-text-secondary hover:border-primary hover:text-primary">Open workflow</Link>
                        <MarkbookDeleteButton assessmentId={assessment.id} />
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
