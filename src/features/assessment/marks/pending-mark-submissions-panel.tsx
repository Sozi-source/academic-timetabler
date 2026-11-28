import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-amber-900">
          Saved but not submitted ({items.length})
        </h2>
      </div>

      <TableContainer label="Saved markbooks pending submission" className="mt-3 border-amber-200 shadow-none">
        <Table>
          <TableHeader className="border-amber-100 bg-amber-50/70">
            <TableRow className="hover:bg-transparent">
              <TableHead>Unit</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead className="text-center">Recorded</TableHead>
              <TableHead>Last saved</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.assessmentId}-${item.component}`}>
                <TableCell className="font-semibold text-text-primary" title={item.unitCode}>
                  {item.unitName}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">{item.component === 'cat' ? 'CAT' : 'Exam'}</TableCell>
                <TableCell className="text-text-secondary">{item.trainerNames.join(', ') || '—'}</TableCell>
                <TableCell className="text-center">
                  <span className={item.missingCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                    {item.enteredCount}/{item.rosterCount}
                  </span>
                  {item.missingCount > 0 ? (
                    <Link
                      href={`/assessment/marks/${item.assessmentId}?status=cat-missing&component=cat`}
                      className="ml-1.5 text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline"
                      title="View candidates missing marks"
                    >
                      ({item.missingCount} missing)
                    </Link>
                  ) : null}
                </TableCell>
                <TableCell className="text-text-muted">
                  {item.lastSavedAt ? dateFormatter.format(new Date(item.lastSavedAt)) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {item.missingCount > 0 ? (
                      <Link
                        href={`/assessment/marks/${item.assessmentId}?status=cat-missing&component=cat`}
                        className="inline-flex h-7 items-center rounded-md border border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 transition"
                      >
                        Review missing
                      </Link>
                    ) : null}
                    <Link
                      href={`/assessment/marks/${item.assessmentId}`}
                      aria-label={`Open markbook for ${item.unitName}`}
                      title={`Open markbook for ${item.unitName}`}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:border-primary/40 hover:bg-surface-subtle hover:text-primary"
                    >
                      <span>Open</span>
                      <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}
