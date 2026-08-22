'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  addRecordOfWorkEntryAction,
  deleteRecordOfWorkEntryAction,
  generateRecordOfWorkFromSchemeAction,
} from './record-of-work-actions';
import {
  generateTVETSchemeOfWork,
  type TVETDocumentHeaderContext,
  type TVETRecordOfWorkEntry,
} from './tvet-standards';

interface ManagerProps {
  allocationId: string;
  header: TVETDocumentHeaderContext;
  entries: TVETRecordOfWorkEntry[];
}

export function RecordOfWorkManager({
  allocationId,
  header,
  entries,
}: ManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const scheme = useMemo(() => generateTVETSchemeOfWork(header), [header]);

  const uniqueWeeks = new Set(entries.map((e) => e.weekNumber)).size;
  const completionRate = Math.min(100, Math.round((uniqueWeeks / 14) * 100));

  const defaultNextWeek = Math.min(14, uniqueWeeks + 1);
  const [selectedWeek, setSelectedWeek] = useState(defaultNextWeek);

  const currentSchemeWeek = scheme.plannedWeeks.find(
    (w) => w.weekNumber === selectedWeek
  );

  const [workCoveredInput, setWorkCoveredInput] = useState(
    currentSchemeWeek
      ? `${currentSchemeWeek.topic}: ${currentSchemeWeek.subTopics}`
      : ''
  );
  const [outcomesInput, setOutcomesInput] = useState(
    currentSchemeWeek ? currentSchemeWeek.specificLearningOutcomes : ''
  );

  const handleWeekChange = (weekNum: number) => {
    setSelectedWeek(weekNum);
    const sw = scheme.plannedWeeks.find((w) => w.weekNumber === weekNum);
    if (sw) {
      setWorkCoveredInput(`${sw.topic}: ${sw.subTopics}`);
      setOutcomesInput(sw.specificLearningOutcomes);
    }
  };

  const sortedEntries = [...entries].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.sessionDate.localeCompare(b.sessionDate)
  );

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await addRecordOfWorkEntryAction(allocationId, formData);
      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to add delivery entry.');
      } else {
        form.reset();
        setIsFormOpen(false);
        setInfoMessage('Session delivery entry logged successfully.');
      }
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!confirm('Are you sure you want to remove this delivery log entry?')) return;
    startTransition(async () => {
      await deleteRecordOfWorkEntryAction(allocationId, entryId);
    });
  };

  const handleAutoGenerateRoadmap = () => {
    if (
      entries.length > 0 &&
      !confirm(
        'Generating from Scheme of Work will replace/standardize current entries to the official 14-week schedule. Continue?'
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await generateRecordOfWorkFromSchemeAction(allocationId);
      if (res.ok) {
        setInfoMessage(`Pre-populated 14-week delivery roadmap from Scheme of Work.`);
      } else {
        setErrorMessage(res.error || 'Failed to generate from Scheme of Work.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/staff/units/${allocationId}/documents`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Documents
          </Link>
          <div>
            <h1 className="text-base font-bold text-text-primary">
              Record of Work Covered
            </h1>
            <p className="text-xs text-text-muted">
              {header.unitCode} · {header.unitName} ({header.cohortName})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/staff/units/${allocationId}/documents/record-of-work/print`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Print Official Record
          </Link>
          <button
            type="button"
            onClick={() => {
              handleWeekChange(defaultNextWeek);
              setIsFormOpen(!isFormOpen);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {isFormOpen ? 'Close Form' : 'Log Delivery Entry'}
          </button>
        </div>
      </div>

      {/* Info / Error Alerts */}
      {infoMessage && (
        <div className="rounded-lg border border-success/30 bg-success-subtle px-4 py-3 text-xs font-semibold text-success">
          {infoMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-xs font-semibold text-danger">
          {errorMessage}
        </div>
      )}

      {/* Progress & Scheme Sync Card */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
              TVET Syllabus Progress & Scheme Alignment
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {uniqueWeeks} / 14 Weeks
              </span>
              <span className="text-xs text-text-secondary">Delivered</span>
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              Synchronised with standard 14-week Scheme of Work (RAT Wk 5, CAT Wk 8, Exam Wk 14)
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAutoGenerateRoadmap}
              disabled={isPending}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
            >
              <Sparkles className="size-3.5" />
              {entries.length === 0
                ? 'Generate 14-Week Roadmap from Scheme'
                : 'Re-sync with Scheme of Work'}
            </button>

            <div className="sm:w-48">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Completion</span>
                <span className="text-primary">{completionRate}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  style={{ width: `${completionRate}%` }}
                  className="h-full rounded-full bg-primary transition-all duration-300"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Entry Form */}
      {isFormOpen && (
        <Card className="p-4 border-primary/30 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Log Teaching Session Delivery
              </h2>
              <p className="text-[11px] text-text-muted">
                Selecting a week auto-populates topics & specific learning outcomes from the Scheme of Work.
              </p>
            </div>
            <Badge variant="success">Auto-Filled from Scheme</Badge>
          </div>

          <form onSubmit={handleAddEntry} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-text-secondary">
                Week Number *
                <select
                  name="weekNumber"
                  required
                  value={selectedWeek}
                  onChange={(e) => handleWeekChange(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-text-secondary">
                Session Date *
                <input
                  type="date"
                  name="sessionDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                />
              </label>

              <label className="block text-xs font-semibold text-text-secondary lg:col-span-2">
                Work Covered / Topics Delivered *
                <input
                  type="text"
                  name="workCovered"
                  required
                  value={workCoveredInput}
                  onChange={(e) => setWorkCoveredInput(e.target.value)}
                  placeholder="e.g. Unit 3: Dietary Assessment Methodologies & Practical Tools"
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-text-secondary">
                Specific Outcomes Achieved
                <input
                  type="text"
                  name="outcomesAchieved"
                  value={outcomesInput}
                  onChange={(e) => setOutcomesInput(e.target.value)}
                  placeholder="e.g. Trainees conducted dietary calculations accurately"
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                />
              </label>

              <label className="block text-xs font-semibold text-text-secondary">
                Student Attendance Summary
                <input
                  type="text"
                  name="attendanceSummary"
                  defaultValue="28/30 Present"
                  placeholder="e.g. 28/30 Present"
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                />
              </label>

              <label className="block text-xs font-semibold text-text-secondary">
                Remarks / Deviations
                <input
                  type="text"
                  name="remarks"
                  defaultValue="Delivered as scheduled"
                  placeholder="e.g. Completed on schedule, no deviations"
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-text-muted hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {isPending ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Logged Delivery Entries Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface-subtle px-4 py-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Delivered Sessions Log ({sortedEntries.length})
          </h2>
          <span className="text-[11px] text-text-muted">
            Auto-linked with Trainer & HOD Sign-off
          </span>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <CalendarCheck2 className="mx-auto size-8 text-text-muted opacity-40" />
            <p className="mt-2 text-sm font-semibold text-text-primary">
              No delivery entries logged yet
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Click &quot;Generate 14-Week Roadmap from Scheme&quot; above to pre-fill all 14 weeks, or click &quot;Log Delivery Entry&quot; to log individual sessions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-3 py-2.5 w-16 text-center">Week</th>
                  <th className="px-3 py-2.5 w-28">Date</th>
                  <th className="px-4 py-2.5">Work Covered</th>
                  <th className="px-3 py-2.5">Outcomes Achieved</th>
                  <th className="px-3 py-2.5 w-28">Attendance</th>
                  <th className="px-3 py-2.5 w-32">Remarks</th>
                  <th className="px-3 py-2.5 w-16 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-subtle/50">
                    <td className="px-3 py-3 text-center font-bold text-text-primary">
                      W{entry.weekNumber}
                    </td>
                    <td className="px-3 py-3 font-medium text-text-secondary whitespace-nowrap">
                      {entry.sessionDate}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {entry.workCovered}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {entry.outcomesAchieved}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {entry.attendanceSummary}
                    </td>
                    <td className="px-3 py-3 text-text-muted text-[11px]">
                      {entry.remarks}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isPending}
                        title="Delete Entry"
                        className="rounded p-1 text-text-muted hover:bg-danger-subtle hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
