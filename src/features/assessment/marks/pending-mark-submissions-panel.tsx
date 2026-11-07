import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

import type { PendingMarkSubmission } from './pending-submissions';

const dateFormatter = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
});

/** HOD dashboard panel: markbooks where trainers saved marks but never pressed Submit. */
export function PendingMarkSubmissionsPanel({ items }: { items: PendingMarkSubmission[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-amber-900">
            Saved but not submitted ({items.length})
          </h2>
          <p className="mt-0.5 text-xs text-amber-800">
            Trainers have saved marks for these markbooks but have not submitted them. Remind the trainer, or open the
            markbook to submit saved CAT marks on their behalf.
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-amber-100 bg-amber-50/70 text-[11px] font-bold text-slate-600">
            <tr>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2">Trainer</th>
              <th className="px-3 py-2 text-center">Recorded</th>
              <th className="px-3 py-2">Last saved</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={`${item.assessmentId}-${item.component}`}>
                <td className="px-3 py-2">
                  <span className="font-mono font-semibold text-slate-900">{item.unitCode}</span>{' '}
                  <span className="text-slate-600">{item.unitName}</span>
                  {item.periodName ? <span className="block text-[11px] text-slate-400">{item.periodName}</span> : null}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-800">{item.component === 'cat' ? 'CAT' : 'Exam'}</td>
                <td className="px-3 py-2 text-slate-700">{item.trainerNames.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={item.missingCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                    {item.enteredCount}/{item.rosterCount}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {item.lastSavedAt ? dateFormatter.format(new Date(item.lastSavedAt)) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/assessment/marks/${item.assessmentId}`}
                    className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open markbook
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
