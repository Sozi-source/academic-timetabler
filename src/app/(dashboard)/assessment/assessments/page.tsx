import { ClipboardPlus, ListChecks, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { createAllAllocatedMarkbooksAction, createAssessmentAction } from '@/features/assessment/actions';
import { getAssessments, getAssessmentSetupOptions } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { MarkbookDeleteButton } from '@/features/assessment/markbook-delete-button';
import { TrainerEntryControl } from '@/features/assessment/trainer-entry-control';

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
          activePeriod ? (
            <form action={createAllAllocatedMarkbooksAction}>
              <input type="hidden" name="academicPeriodId" value={activePeriod.id} />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-95"
              >
                <Sparkles className="size-3.5" />
                Generate all allocated markbooks
              </button>
            </form>
          ) : null
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
        <div className="overflow-x-auto">
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
                const finalized = Boolean(assessment.exam_marks_finalized_at || assessment.status === 'closed');
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
                        <TrainerEntryControl assessmentId={assessment.id} isOpen={assessment.trainer_entry_open} disabled={finalized || !assessment.population?.[0]?.count} />
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
