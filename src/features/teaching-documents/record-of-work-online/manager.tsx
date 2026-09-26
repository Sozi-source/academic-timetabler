'use client';

import { useState, useActionState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  Pencil,
  UserCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';

import {
  submitOnlineRecordOfWorkAction,
} from './actions';
import {
  initialRecordOfWorkActionState,
  type OnlineRecordOfWorkContext,
  type OnlineRecordOfWorkEntry,
  type OnlineRecordOfWorkOccurrence,
} from './types';
import { cn } from '@/lib/utils/cn';

function prettyDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

// Simple Record Lesson Modal
function RecordLessonModal({
  allocationId,
  occurrence,
  onClose,
}: {
  allocationId: string;
  occurrence: OnlineRecordOfWorkOccurrence;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    submitOnlineRecordOfWorkAction,
    initialRecordOfWorkActionState
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-5 py-3 shrink-0">
          <div>
            <h3 className="text-sm font-black text-slate-900">Record Lesson</h3>
            <p className="text-xs text-slate-500 font-medium">
              Week {occurrence.weekNumber} · {prettyDate(occurrence.sessionDate)} ({occurrence.timeLabel})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form action={action} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <input type="hidden" name="allocationId" value={allocationId} />
          <input type="hidden" name="occurrenceKey" value={occurrence.occurrenceKey} />

          {/* Scheme Sync / Status Notification */}
          {!occurrence.canSubmit ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900 border border-amber-200">
              <Clock3 className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Future Lesson (Locked)</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Scheduled for {prettyDate(occurrence.sessionDate)}. Lessons can only be submitted on or after their scheduled date.
                </p>
              </div>
            </div>
          ) : (occurrence.topicSuggestion || occurrence.objectivesSuggestion) ? (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 border border-teal-200">
              <CheckCircle2 className="size-4 text-teal-700 shrink-0" />
              <span>Pre-filled from Week {occurrence.weekNumber} Scheme of Work. Click Save to confirm.</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No scheme entry found for Week {occurrence.weekNumber}. Enter lesson coverage details below.
            </p>
          )}

          {/* Topic Covered */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>Work / Topic Covered</span>
              <span className="text-[10px] text-slate-500 font-normal">From Scheme of Work</span>
            </label>
            <textarea
              name="topicCovered"
              defaultValue={occurrence.topicSuggestion}
              rows={2}
              required
              disabled={!occurrence.canSubmit}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 leading-relaxed disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Topic covered in this session..."
            />
          </div>

          {/* Learning Objectives */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>Specific Learning Outcomes Achieved</span>
              <span className="text-[10px] text-slate-500 font-normal">From Scheme of Work</span>
            </label>
            <textarea
              name="objectives"
              defaultValue={occurrence.objectivesSuggestion}
              rows={4}
              required
              disabled={!occurrence.canSubmit}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 leading-relaxed disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Learners were able to..."
            />
          </div>

          {/* Delivery Mode & Remarks */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-900">Delivery Mode</label>
              <input
                name="deliveryMode"
                defaultValue={occurrence.deliveryMode || 'theory'}
                required
                disabled={!occurrence.canSubmit}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-700 disabled:bg-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-900">Remarks</label>
              <input
                name="remarks"
                defaultValue="Covered as planned in Scheme of Work"
                disabled={!occurrence.canSubmit}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-700 disabled:bg-slate-100"
                placeholder="e.g. As planned"
              />
            </div>
          </div>

          {/* Class Rep Confirmation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-teal-700" />
              Class Representative Confirmation
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                name="classRepresentativeName"
                defaultValue="Class Representative"
                disabled={!occurrence.canSubmit}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-700 disabled:bg-slate-100"
                placeholder="Representative Name"
              />
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="classRepresentativeConfirmed"
                  defaultChecked={true}
                  disabled={!occurrence.canSubmit}
                  className="size-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <span>Work coverage confirmed</span>
              </label>
            </div>
          </div>

          {/* State Message */}
          {state.message && (
            <p className={cn('text-xs font-bold', state.status === 'success' ? 'text-emerald-700' : 'text-rose-700')}>
              {state.message}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !occurrence.canSubmit}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-teal-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <CheckCircle2 className="size-4" />
              {pending ? 'Saving...' : !occurrence.canSubmit ? 'Locked (Future)' : 'Confirm & Submit Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OnlineRecordOfWorkManager({ context }: { context: OnlineRecordOfWorkContext }) {
  const [activeOccurrence, setActiveOccurrence] = useState<OnlineRecordOfWorkOccurrence | null>(null);

  const submitted = context.entries;
  const pending = context.occurrences;

  // Combine submitted entries and pending occurrences into a single unified timeline
  const submittedKeys = new Set(submitted.map((s) => `${s.sessionDate}:${s.timeLabel}`));

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. SIMPLE HEADER CARD */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/units/${context.allocationId}/documents`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Documents
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Record of Work
              </h1>
              <p className="text-xs text-slate-600">
                {context.header.unitCode} · {context.header.unitName}
              </p>
            </div>
          </div>
        </div>

        {/* Meta Row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span><strong className="text-slate-900">Class:</strong> {context.header.cohortName}</span>
          <span><strong className="text-slate-900">Period:</strong> {context.header.academicPeriodName}</span>
          <span><strong className="text-slate-900">Trainer:</strong> {context.header.trainerName}</span>
          <span className="sm:ml-auto text-teal-800 font-bold">
            {submitted.length} recorded · {pending.length} pending
          </span>
        </div>
      </section>

      {/* 2. RESPONSIVE RECORD OF WORK LOG */}
      {!context.timetable.available ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-xs">
          <FileCheck2 className="mx-auto size-6 text-slate-400 mb-2" />
          No published timetable found for this allocation.
        </section>
      ) : (
        <>
          {/* A. MOBILE CARDS VIEW (< md) */}
          <div className="space-y-3 md:hidden">
            {/* 1. Submitted Entries */}
            {submitted.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-teal-200/80 bg-white p-4 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">
                    Week {entry.weekNumber ?? '—'} · {prettyDate(entry.sessionDate)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200">
                    <CheckCircle2 className="size-3 text-teal-700" />
                    Recorded
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500">{entry.timeLabel}</p>

                <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                  <p className="text-xs font-bold text-slate-900">{entry.workCovered}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                    {entry.outcomesAchieved}
                  </p>
                  {entry.remarks && (
                    <p className="text-[10px] text-slate-500 italic mt-1">Remark: {entry.remarks}</p>
                  )}
                </div>
              </div>
            ))}

            {/* 2. Pending Occurrences */}
            {pending.map((occ) => {
              const isSubmitted = submittedKeys.has(`${occ.sessionDate}:${occ.timeLabel}`);
              if (isSubmitted) return null;

              return (
                <div
                  key={occ.occurrenceKey}
                  className={cn(
                    'rounded-xl border bg-white p-4 shadow-xs space-y-2.5 transition',
                    occ.timingStatus === 'today'
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">
                      Week {occ.weekNumber} · {prettyDate(occ.sessionDate)}
                    </span>
                    {occ.canSubmit ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                        Ready to Record
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                        <Clock3 className="size-3" />
                        Scheduled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">{occ.timeLabel}</p>

                  <div className="rounded-lg bg-slate-50/80 p-2.5 space-y-1">
                    <p className="text-xs font-bold text-slate-900">{occ.topicSuggestion || '—'}</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                      {occ.objectivesSuggestion || '—'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveOccurrence(occ)}
                    className={cn(
                      'w-full flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold shadow-xs transition',
                      occ.canSubmit
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    )}
                  >
                    {occ.canSubmit ? (
                      <>
                        <Pencil className="size-3.5" />
                        Record Lesson
                      </>
                    ) : (
                      <>
                        <Clock3 className="size-3.5 text-slate-500" />
                        View Scheduled Details
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* B. DESKTOP MASTER TABLE (>= md) */}
          <section className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[720px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-3.5 py-2.5 w-[14%]">Date & Week</th>
                    <th className="px-3 py-2.5 w-[11%]">Time</th>
                    <th className="px-3.5 py-2.5 w-[33%]">Work / Topic Covered</th>
                    <th className="px-3.5 py-2.5 w-[28%]">Outcomes Achieved</th>
                    <th className="px-3 py-2.5 w-[14%] text-center">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Submitted Entries */}
                  {submitted.map((entry, idx) => (
                    <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50/40 align-top'}>
                      <td className="px-3.5 py-3 font-bold text-slate-900">
                        {prettyDate(entry.sessionDate)}
                        <span className="block text-[10px] font-medium text-slate-500">
                          Week {entry.weekNumber ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-medium whitespace-nowrap">
                        {entry.timeLabel}
                      </td>
                      <td className="px-3.5 py-3 text-slate-900 leading-snug">
                        <p className="font-semibold">{entry.workCovered}</p>
                        {entry.remarks && (
                          <p className="mt-0.5 text-[11px] text-slate-500 italic">Remark: {entry.remarks}</p>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-slate-700 leading-relaxed whitespace-pre-line">
                        {entry.outcomesAchieved}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200">
                          <CheckCircle2 className="size-3 text-teal-700" />
                          Recorded
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Pending Occurrences */}
                  {pending.map((occ, idx) => {
                    const isSubmitted = submittedKeys.has(`${occ.sessionDate}:${occ.timeLabel}`);
                    if (isSubmitted) return null;

                    return (
                      <tr
                        key={occ.occurrenceKey}
                        className={cn(
                          'align-top transition',
                          occ.timingStatus === 'today'
                            ? 'bg-amber-50/40'
                            : (submitted.length + idx) % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/40'
                        )}
                      >
                        <td className="px-3.5 py-3 font-bold text-slate-900">
                          {prettyDate(occ.sessionDate)}
                          <span className="block text-[10px] font-medium text-slate-500">
                            Week {occ.weekNumber}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600 font-medium whitespace-nowrap">
                          {occ.timeLabel}
                        </td>
                        <td className="px-3.5 py-3 text-slate-700 leading-snug">
                          <p className="font-medium text-slate-800">{occ.topicSuggestion || '—'}</p>
                          <span className="text-[10px] text-slate-400 italic">(Planned)</span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 leading-relaxed whitespace-pre-line">
                          {occ.objectivesSuggestion || '—'}
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          {occ.canSubmit ? (
                            <button
                              type="button"
                              onClick={() => setActiveOccurrence(occ)}
                              className="inline-flex h-7 items-center gap-1 rounded bg-slate-900 px-2.5 text-[11px] font-bold text-white shadow-xs hover:bg-slate-800 transition"
                            >
                              <Pencil className="size-3" />
                              Record
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveOccurrence(occ)}
                              className="inline-flex h-7 items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition"
                              title="Click to view scheduled lesson"
                            >
                              <Clock3 className="size-3 text-slate-400" />
                              Scheduled
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* 3. RECORD LESSON MODAL */}
      {activeOccurrence && (
        <RecordLessonModal
          allocationId={context.allocationId}
          occurrence={activeOccurrence}
          onClose={() => setActiveOccurrence(null)}
        />
      )}
    </div>
  );
}
