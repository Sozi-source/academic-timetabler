'use client';

import { CheckCircle2, LoaderCircle, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useOptimistic, useState } from 'react';
import { toast } from 'sonner';

import { quickUpdateStudentStatusAction } from './actions';
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

  const programme = student.programme?.code ?? '—';
  const cohort = student.current_cohort?.name ?? student.admission_cohort?.name ?? '—';

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,2.5fr)_minmax(140px,1.2fr)_minmax(180px,1.4fr)_40px] sm:gap-4">
      {/* Student identity */}
      <div className="min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="truncate text-xs font-semibold text-text-primary hover:text-primary transition-colors block"
        >
          {student.full_name}
        </Link>
        <p className="mt-0.5 truncate text-[0.6875rem] text-text-muted">
          <span className="sm:hidden font-mono text-[11px] text-text-secondary mr-1.5">{student.admission_number} ·</span>
          {programme} · {cohort}
        </p>

        {/* Mobile: status dropdown */}
        <div className="mt-2.5 sm:hidden">
          <select
            value={state.virtualStatus}
            disabled={state.saving}
            onChange={(e) => save(e.target.value as VirtualStatus)}
            aria-label={`Status for ${student.full_name}`}
            className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Admission Number column (desktop) */}
      <div className="hidden sm:block min-w-0">
        <Link
          href={`/students/registry/${student.id}`}
          className="font-mono text-xs font-medium text-text-secondary hover:text-primary transition-colors inline-block"
        >
          {student.admission_number}
        </Link>
      </div>

      {/* Status dropdown (desktop) */}
      <div className="hidden sm:block">
        <select
          value={state.virtualStatus}
          disabled={state.saving}
          onChange={(e) => save(e.target.value as VirtualStatus)}
          aria-label={`Status for ${student.full_name}`}
          className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Save indicator */}
      <div className="flex h-8 w-10 shrink-0 items-center justify-center">
        {state.saving ? (
          <LoaderCircle className="size-4 animate-spin text-primary" />
        ) : state.saved ? (
          <CheckCircle2 className="size-4 text-success" />
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

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.6875rem] font-semibold transition ${
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-border bg-surface text-text-secondary hover:bg-surface-subtle'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Column headers (desktop) */}
      <div className="hidden rounded-lg border border-border bg-surface sm:grid sm:grid-cols-[minmax(0,2.5fr)_minmax(140px,1.2fr)_minmax(180px,1.4fr)_40px] sm:items-center sm:gap-4 sm:px-4 sm:py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Student</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Admission No.</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Status</span>
        <span className="w-10" />
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
