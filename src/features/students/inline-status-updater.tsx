'use client';

import { CheckCircle2, ChevronDown, LoaderCircle, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useOptimistic, useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';
import { quickUpdateStudentStatusAction } from './actions';
import { getStudentStageLabel } from './student-status-stage';
import type { StudentRow } from './types';

// ─── Virtual status helpers (mirrors progression-form.tsx) ───────────────────

type VirtualStatus =
  | 'in_class'
  | 'on_attachment'
  | 'deferred'
  | 'dropped_out'
  | 'suspended'
  | 'completed'
  | 'graduated';

const STATUS_OPTIONS: [VirtualStatus, string][] = [
  ['in_class', 'In Class'],
  ['on_attachment', 'On Attachment'],
  ['deferred', 'Deferred'],
  ['dropped_out', 'Dropped Out'],
  ['suspended', 'Suspended'],
  ['completed', 'Completed'],
  ['graduated', 'Graduated'],
];

const STATUS_CONFIG: Record<
  VirtualStatus,
  { label: string; dot: string; selectBg: string }
> = {
  in_class: {
    label: 'In Class',
    dot: 'bg-teal-600',
    selectBg: 'border-teal-400/80 bg-teal-50 text-teal-900 hover:border-teal-500 focus:ring-teal-500/30',
  },
  on_attachment: {
    label: 'On Attachment',
    dot: 'bg-blue-600',
    selectBg: 'border-blue-300/80 bg-blue-50 text-blue-900 hover:border-blue-400 focus:ring-blue-400/30',
  },
  deferred: {
    label: 'Deferred',
    dot: 'bg-amber-600',
    selectBg: 'border-amber-300/80 bg-amber-50 text-amber-900 hover:border-amber-400 focus:ring-amber-400/30',
  },
  suspended: {
    label: 'Suspended',
    dot: 'bg-orange-600',
    selectBg: 'border-orange-300/80 bg-orange-50 text-orange-900 hover:border-orange-400 focus:ring-orange-400/30',
  },
  dropped_out: {
    label: 'Dropped Out',
    dot: 'bg-rose-600',
    selectBg: 'border-rose-300/80 bg-rose-50 text-rose-900 hover:border-rose-400 focus:ring-rose-400/30',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-purple-600',
    selectBg: 'border-purple-300/80 bg-purple-50 text-purple-900 hover:border-purple-400 focus:ring-purple-400/30',
  },
  graduated: {
    label: 'Graduated',
    dot: 'bg-slate-500',
    selectBg: 'border-slate-300/80 bg-slate-100 text-slate-800 hover:border-slate-400 focus:ring-slate-400/30',
  },
};

const STATUS_FILTER_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'in_class', label: 'In Class' },
  { value: 'on_attachment', label: 'On Attachment' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'dropped_out', label: 'Dropped Out' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'completed', label: 'Completed' },
  { value: 'graduated', label: 'Graduated' },
];

function toVirtualStatus(
  lifecycle: string,
  phase: string | null | undefined,
): VirtualStatus {
  if (lifecycle === 'active' || lifecycle === 'admitted') {
    return phase === 'attachment' ? 'on_attachment' : 'in_class';
  }
  return lifecycle as VirtualStatus;
}

function matchesFilter(student: StudentRow, filter: string): boolean {
  if (!filter) return true;
  const v = toVirtualStatus(student.lifecycle_status, student.academic_phase);
  return v === filter;
}

function matchesSearch(student: StudentRow, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  return (
    (student.full_name ?? '').toLowerCase().includes(lq) ||
    (student.admission_number ?? '').toLowerCase().includes(lq) ||
    (student.programme?.code ?? '').toLowerCase().includes(lq) ||
    (student.current_cohort?.name ?? '').toLowerCase().includes(lq)
  );
}

// ─── Individual row ───────────────────────────────────────────────────────────

interface RowState {
  virtualStatus: VirtualStatus;
  saving: boolean;
  saved: boolean;
}

function InlineStatusRow({ student }: { student: StudentRow }) {
  const initialVirtual = toVirtualStatus(student.lifecycle_status, student.academic_phase);

  const [state, setOptimistic] = useOptimistic<RowState, Partial<RowState>>(
    {
      virtualStatus: initialVirtual,
      saving: false,
      saved: false,
    },
    (prev, patch) => ({ ...prev, ...patch }),
  );

  async function save(nextVirtual: VirtualStatus) {
    const previousVirtual = state.virtualStatus;

    startTransition(async () => {
      setOptimistic({ virtualStatus: nextVirtual, saving: true, saved: false });
      const result = await quickUpdateStudentStatusAction(student.id, nextVirtual);
      if (result.success) {
        setOptimistic({ saving: false, saved: true });
        toast.success(`${student.full_name} — ${result.message}`);
        // brief flash then clear saved indicator
        setTimeout(() => setOptimistic({ saved: false }), 2000);
      } else {
        // revert
        setOptimistic({ virtualStatus: previousVirtual, saving: false, saved: false });
        toast.error(`${student.full_name} — ${result.message}`);
      }
    });
  }

  const stage = getStudentStageLabel(student);
  const config = STATUS_CONFIG[state.virtualStatus] ?? STATUS_CONFIG.in_class;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border/60 px-4 py-1.5 text-xs transition hover:bg-surface-subtle/70 last:border-0 sm:grid-cols-[repeat(4,minmax(0,1fr))_36px] sm:gap-4 sm:py-0 sm:h-10">
      {/* Student identity */}
      <div className="min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="truncate text-xs font-semibold text-text-primary hover:text-primary transition-colors block leading-tight"
          title={student.full_name}
        >
          {student.full_name}
        </Link>
        {/* Mobile secondary details */}
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-text-muted sm:hidden">
          <span className="font-mono text-text-secondary">{student.admission_number}</span>
          <span>·</span>
          <span className="font-semibold text-text-secondary">{stage}</span>
        </div>
      </div>

      {/* Admission Number column (desktop) */}
      <div className="hidden sm:block min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="font-mono text-xs font-medium text-text-secondary hover:text-primary transition-colors truncate block"
          title={student.admission_number}
        >
          {student.admission_number}
        </Link>
      </div>

      {/* Current Stage column (desktop) */}
      <div className="hidden sm:block min-w-0">
        <span className="inline-flex min-h-5 items-center rounded-md border border-border/80 bg-surface-subtle px-2 py-0 text-[11px] font-semibold text-text-secondary">
          {stage}
        </span>
      </div>

      {/* Status dropdown (desktop) */}
      <div className="hidden sm:block">
        <div className="relative flex items-center">
          <span
            className={cn('pointer-events-none absolute left-2.5 size-2 rounded-full shrink-0', config.dot)}
            aria-hidden="true"
          />
          <select
            value={state.virtualStatus}
            disabled={state.saving}
            onChange={(e) => save(e.target.value as VirtualStatus)}
            aria-label={`Status for ${student.full_name}`}
            className={cn(
              'h-7.5 w-full appearance-none rounded-md border pl-6 pr-7 text-xs font-semibold outline-none transition cursor-pointer',
              'focus:ring-2 focus:ring-offset-0 disabled:opacity-60',
              config.selectBg,
            )}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value} className="bg-surface text-text-primary font-normal">
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 size-3.5 opacity-60 text-current"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Mobile: status dropdown */}
      <div className="col-span-2 pt-1 pb-1 sm:hidden">
        <div className="relative flex items-center">
          <span
            className={cn('pointer-events-none absolute left-2.5 size-2 rounded-full shrink-0', config.dot)}
            aria-hidden="true"
          />
          <select
            value={state.virtualStatus}
            disabled={state.saving}
            onChange={(e) => save(e.target.value as VirtualStatus)}
            aria-label={`Status for ${student.full_name}`}
            className={cn(
              'h-7.5 w-full appearance-none rounded-md border pl-6 pr-7 text-xs font-semibold outline-none transition cursor-pointer',
              config.selectBg,
            )}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value} className="bg-surface text-text-primary font-normal">
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 size-3.5 opacity-60 text-current"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Save indicator */}
      <div className="flex h-7.5 w-9 shrink-0 items-center justify-center">
        {state.saving ? (
          <LoaderCircle className="size-3.5 animate-spin text-primary" />
        ) : state.saved ? (
          <CheckCircle2 className="size-3.5 text-success" />
        ) : null}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InlineStatusUpdaterProps {
  students: StudentRow[];
}

export function InlineStatusUpdater({ students }: InlineStatusUpdaterProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = students.filter(
    (s) => matchesFilter(s, statusFilter) && matchesSearch(s, search),
  );

  // Count per tab
  const counts: Record<string, number> = { '': students.length };
  for (const s of students) {
    const v = toVirtualStatus(s.lifecycle_status, s.academic_phase);
    counts[v] = (counts[v] ?? 0) + 1;
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, admission number, programme…"
          className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Filter tabs with color dots */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          const active = statusFilter === tab.value;
          const dotColor = tab.value ? STATUS_CONFIG[tab.value as VirtualStatus]?.dot : null;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.6875rem] font-semibold transition cursor-pointer',
                active
                  ? 'bg-primary text-white shadow-xs'
                  : 'border border-border bg-surface text-text-secondary hover:bg-surface-subtle',
              )}
            >
              {dotColor ? (
                <span
                  className={cn(
                    'size-1.5 rounded-full shrink-0',
                    active ? 'bg-white' : dotColor,
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {tab.label}
              <span
                className={cn(
                  'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  active ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Column headers (desktop) - equidistant columns */}
      <div className="hidden rounded-lg border border-border bg-surface sm:grid sm:grid-cols-[repeat(4,minmax(0,1fr))_36px] sm:items-center sm:gap-4 sm:px-4 sm:h-8.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Student</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Admission No.</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Current Stage</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Status</span>
        <span className="w-9" />
      </div>

      {/* Student rows */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <UserRound className="size-8 text-text-muted/40" />
            <p className="text-xs font-semibold text-text-primary">No students match</p>
            <p className="text-[0.6875rem] text-text-muted">
              Try adjusting your search or filter.
            </p>
          </div>
        ) : (
          filtered.map((student) => (
            <InlineStatusRow key={student.id} student={student} />
          ))
        )}
      </div>

      <p className="text-[0.6875rem] text-text-muted">
        Showing {filtered.length} of {students.length} students · Changes are saved automatically.
      </p>
    </div>
  );
}
