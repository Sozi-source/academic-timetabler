'use client';

import { Check, ChevronDown, LoaderCircle, CheckCircle2, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useOptimistic, useState } from 'react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { quickUpdateStudentStatusAction } from './actions';
import { getStudentStageLabel } from './student-status-stage';
import type { StudentRow } from './types';

// ─── Virtual status helpers ───────────────────────────────────────────────────

type VirtualStatus =
  | 'in_class'
  | 'on_attachment'
  | 'deferred'
  | 'dropped_out'
  | 'suspended'
  | 'completed'
  | 'graduated';

interface StatusConfig {
  label: string;
  /** Tailwind colour classes for the pill when it is the active/selected state */
  pill: string;
  /** Small dot colour */
  dot: string;
  /** Hover tint for the dropdown item */
  itemHover: string;
}

const STATUS_CONFIG: Record<VirtualStatus, StatusConfig> = {
  in_class: {
    label: 'In Class',
    pill: 'bg-teal-600/10 text-teal-800 border-teal-600/25 hover:bg-teal-600/15',
    dot: 'bg-teal-600',
    itemHover: 'focus:bg-teal-50',
  },
  on_attachment: {
    label: 'On Attachment',
    pill: 'bg-blue-600/10 text-blue-800 border-blue-600/25 hover:bg-blue-600/15',
    dot: 'bg-blue-600',
    itemHover: 'focus:bg-blue-50',
  },
  deferred: {
    label: 'Deferred',
    pill: 'bg-amber-500/10 text-amber-800 border-amber-500/25 hover:bg-amber-500/15',
    dot: 'bg-amber-500',
    itemHover: 'focus:bg-amber-50',
  },
  suspended: {
    label: 'Suspended',
    pill: 'bg-orange-500/10 text-orange-800 border-orange-500/25 hover:bg-orange-500/15',
    dot: 'bg-orange-500',
    itemHover: 'focus:bg-orange-50',
  },
  dropped_out: {
    label: 'Dropped Out',
    pill: 'bg-rose-600/10 text-rose-800 border-rose-600/25 hover:bg-rose-600/15',
    dot: 'bg-rose-600',
    itemHover: 'focus:bg-rose-50',
  },
  completed: {
    label: 'Completed',
    pill: 'bg-purple-600/10 text-purple-800 border-purple-600/25 hover:bg-purple-600/15',
    dot: 'bg-purple-600',
    itemHover: 'focus:bg-purple-50',
  },
  graduated: {
    label: 'Graduated',
    pill: 'bg-slate-500/10 text-slate-700 border-slate-500/25 hover:bg-slate-500/15',
    dot: 'bg-slate-500',
    itemHover: 'focus:bg-slate-100',
  },
};

const STATUS_OPTIONS: VirtualStatus[] = [
  'in_class',
  'on_attachment',
  'deferred',
  'suspended',
  'dropped_out',
  'completed',
  'graduated',
];

const STATUS_FILTER_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  ...STATUS_OPTIONS.map((v) => ({ value: v, label: STATUS_CONFIG[v].label })),
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

// ─── Status Pill Trigger ──────────────────────────────────────────────────────

function StatusPill({
  status,
  saving,
  onSelect,
}: {
  status: VirtualStatus;
  saving: boolean;
  onSelect: (v: VirtualStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          aria-label={`Change status: currently ${cfg.label}`}
          className={cn(
            'inline-flex h-7 w-full max-w-[190px] items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold transition cursor-pointer',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            cfg.pill,
          )}
        >
          {saving ? (
            <LoaderCircle className="size-3 shrink-0 animate-spin" />
          ) : (
            <span className={cn('size-[7px] shrink-0 rounded-full', cfg.dot)} aria-hidden="true" />
          )}
          <span className="flex-1 truncate text-left">{cfg.label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={5}
        className="min-w-[170px] p-1"
      >
        {STATUS_OPTIONS.map((v) => {
          const c = STATUS_CONFIG[v];
          const active = v === status;
          return (
            <DropdownMenuItem
              key={v}
              onSelect={() => onSelect(v)}
              className={cn(
                'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition',
                c.itemHover,
                active && 'font-semibold',
              )}
            >
              <span className={cn('size-[7px] shrink-0 rounded-full', c.dot)} aria-hidden="true" />
              <span className="flex-1">{c.label}</span>
              {active && <Check className="size-3.5 opacity-70" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
    { virtualStatus: initialVirtual, saving: false, saved: false },
    (prev, patch) => ({ ...prev, ...patch }),
  );

  function save(nextVirtual: VirtualStatus) {
    if (nextVirtual === state.virtualStatus) return;
    const previousVirtual = state.virtualStatus;
    startTransition(async () => {
      setOptimistic({ virtualStatus: nextVirtual, saving: true, saved: false });
      const result = await quickUpdateStudentStatusAction(student.id, nextVirtual);
      if (result.success) {
        setOptimistic({ saving: false, saved: true });
        toast.success(`${student.full_name} — ${result.message}`);
        setTimeout(() => setOptimistic({ saved: false }), 2000);
      } else {
        setOptimistic({ virtualStatus: previousVirtual, saving: false, saved: false });
        toast.error(`${student.full_name} — ${result.message}`);
      }
    });
  }

  const stage = getStudentStageLabel(student);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border/60 px-4 py-2 last:border-0 transition hover:bg-surface-subtle/60 sm:grid-cols-[repeat(4,minmax(0,1fr))_36px] sm:gap-4 sm:py-0 sm:h-11">
      {/* Student identity */}
      <div className="min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="truncate text-xs font-semibold text-text-primary hover:text-primary transition-colors block leading-tight"
          title={student.full_name}
        >
          {student.full_name}
        </Link>
        {/* Mobile secondary line */}
        <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-text-muted sm:hidden">
          <span className="font-mono text-text-secondary">{student.admission_number}</span>
          <span>·</span>
          <span className="font-semibold">{stage}</span>
        </p>
        {/* Mobile status pill */}
        <div className="mt-2 pb-1 sm:hidden">
          <StatusPill status={state.virtualStatus} saving={state.saving} onSelect={save} />
        </div>
      </div>

      {/* Admission Number (desktop) */}
      <div className="hidden sm:block min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="font-mono text-xs font-medium text-text-secondary hover:text-primary transition-colors truncate block"
          title={student.admission_number}
        >
          {student.admission_number}
        </Link>
      </div>

      {/* Current Stage (desktop) */}
      <div className="hidden sm:flex items-center">
        <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface-subtle px-2.5 text-[11px] font-semibold text-text-secondary">
          {stage}
        </span>
      </div>

      {/* Status pill (desktop) */}
      <div className="hidden sm:flex items-center">
        <StatusPill status={state.virtualStatus} saving={state.saving} onSelect={save} />
      </div>

      {/* Save indicator */}
      <div className="flex h-8 w-9 shrink-0 items-center justify-center">
        {state.saved ? (
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

  const counts: Record<string, number> = { '': students.length };
  for (const s of students) {
    const v = toVirtualStatus(s.lifecycle_status, s.academic_phase);
    counts[v] = (counts[v] ?? 0) + 1;
  }

  return (
    <div className="space-y-3">
      {/* Search */}
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

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          const active = statusFilter === tab.value;
          const dot = tab.value
            ? STATUS_CONFIG[tab.value as VirtualStatus]?.dot
            : null;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[0.6875rem] font-semibold transition cursor-pointer',
                active
                  ? 'bg-primary text-white shadow-xs'
                  : 'border border-border bg-surface text-text-secondary hover:bg-surface-subtle',
              )}
            >
              {dot ? (
                <span
                  className={cn('size-[6px] rounded-full shrink-0', active ? 'bg-white' : dot)}
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

      {/* Column headers (desktop) */}
      <div className="hidden rounded-lg border border-border bg-surface sm:grid sm:grid-cols-[repeat(4,minmax(0,1fr))_36px] sm:items-center sm:gap-4 sm:px-4 sm:h-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Student</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Admission No.</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Stage</span>
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
