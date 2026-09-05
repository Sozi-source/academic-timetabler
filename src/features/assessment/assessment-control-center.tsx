'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import type {
  AssessmentControlCenterData,
} from './control-center-queries';

type AnalysisTab = 'all' | 'cat' | 'exam';

export function AssessmentControlCenter({ data }: { data: AssessmentControlCenterData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'draft' | 'pending'>('all');

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      // 1. Search filter
      const q = search.trim().toLowerCase();
      if (q) {
        const matchesUnit =
          item.unitCode.toLowerCase().includes(q) ||
          item.unitName.toLowerCase().includes(q);
        const matchesTrainer = item.trainerNames.some((t) =>
          t.toLowerCase().includes(q)
        );
        const matchesCohort = item.cohortNames.some((c) =>
          c.toLowerCase().includes(q)
        );
        if (!matchesUnit && !matchesTrainer && !matchesCohort) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === 'submitted' && !item.isSubmitted) return false;
      if (statusFilter === 'draft' && (item.isSubmitted || item.satCount === 0)) return false;
      if (statusFilter === 'pending' && item.satCount > 0) return false;

      return true;
    });
  }, [data.items, search, statusFilter]);

  const handlePeriodChange = (periodId: string) => {
    router.push(`/assessment?periodId=${periodId}`);
  };

  // Overall metrics calculation
  const totalUnits = data.items.length;
  const submittedUnits = data.items.filter((i) => i.isSubmitted).length;
  const inProgressUnits = data.items.filter((i) => !i.isSubmitted && i.satCount > 0).length;
  const pendingUnits = data.items.filter((i) => i.satCount === 0).length;
  const submissionRate = totalUnits > 0 ? Math.round((submittedUnits / totalUnits) * 100) : 0;

  const totalCandidates = data.summary.totalPopulation;
  const totalSat = data.items.reduce((acc, i) => acc + i.satCount, 0);

  return (
    <div className="space-y-4 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Results & Exams Analysis"
        icon={GraduationCap}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              value={data.selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-text-primary shadow-2xs focus:border-primary focus:outline-none cursor-pointer"
            >
              {data.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'active' ? '(Active)' : `(${p.status})`}
                </option>
              ))}
            </select>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary shadow-2xs hover:bg-surface-subtle transition active:scale-95"
            >
              <ArrowLeft className="size-3.5" />
              <span>Operations</span>
            </Link>
            <Link
              href="/assessment/reports"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary shadow-2xs hover:bg-surface-subtle transition active:scale-95"
            >
              <FileText className="size-3.5" />
              <span>Reports</span>
            </Link>
          </div>
        }
      />

      {/* Top 4 Analytics Telemetry Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Allocated Units */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Allocated Units
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
              <ClipboardList className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black tracking-tight text-text-primary">
              {totalUnits}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">{data.selectedPeriodName}</p>
          </div>
          <div className="mt-2.5 h-0.5 w-6 rounded-full bg-primary" />
        </div>

        {/* Metric 2: Submissions */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Submitted
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold">
              <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black tracking-tight text-text-primary">
              {submittedUnits} / {totalUnits} ({submissionRate}%)
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {inProgressUnits} draft · {pendingUnits} pending
            </p>
          </div>
          <div className="mt-2.5 h-0.5 w-6 rounded-full bg-emerald-600" />
        </div>

        {/* Metric 3: Candidate Population */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition hover:border-institutional-yellow/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Candidates
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-institutional-yellow-soft text-institutional-yellow-ink font-bold">
              <UsersRound className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black tracking-tight text-text-primary">
              {totalCandidates} Enrolled
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Active cohorts</p>
          </div>
          <div className="mt-2.5 h-0.5 w-6 rounded-full bg-institutional-yellow" />
        </div>

        {/* Metric 4: Marks Sat */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Sittings
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
              <BarChart3 className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black tracking-tight text-text-primary">
              {totalSat} Completed
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Assessment entries</p>
          </div>
          <div className="mt-2.5 h-0.5 w-6 rounded-full bg-primary" />
        </div>
      </div>

      {/* Analysis Tabs & Filter Strip */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5">
          {/* Analysis Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1 border border-border text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'all'
                  ? 'bg-surface text-primary shadow-2xs border border-border'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All ({data.items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cat')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'cat'
                  ? 'bg-surface text-primary shadow-2xs border border-border'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              CAT (/15)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exam')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                activeTab === 'exam'
                  ? 'bg-surface text-primary shadow-2xs border border-border'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Exams (/70 & /100)
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-primary shadow-2xs outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="draft">In Draft</option>
              <option value="pending">Pending</option>
            </select>

            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search unit or trainer..."
                className="h-8 w-full rounded-lg border border-border bg-surface pl-8 pr-7 text-xs text-text-primary placeholder:text-text-muted shadow-2xs outline-none focus:border-primary"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Units Table */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <FileSpreadsheet className="mx-auto size-7 text-text-muted" />
            <p className="mt-2 text-xs font-bold text-text-primary">
              {search ? `No units match "${search}"` : 'No units found'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Unit</th>
                  <th className="px-3 py-2.5">Trainer(s)</th>
                  <th className="px-3 py-2.5">Cohort</th>
                  <th className="px-3 py-2.5 text-center">Candidates</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  {activeTab === 'cat' ? (
                    <>
                      <th className="px-3 py-2.5 text-center">CAT Sat</th>
                      <th className="px-3 py-2.5 text-center">Max /15</th>
                    </>
                  ) : activeTab === 'exam' ? (
                    <>
                      <th className="px-3 py-2.5 text-center">Exam Sat</th>
                      <th className="px-3 py-2.5 text-center">Finalized</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-center">Sat</th>
                      <th className="px-3 py-2.5 text-center">Missing</th>
                    </>
                  )}
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const isSubmitted = item.isSubmitted;
                  const isDraft = !isSubmitted && item.satCount > 0;

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-primary-subtle/20"
                    >
                      {/* Unit Code & Title */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary-deep border border-primary/15">
                            {item.unitCode}
                          </span>
                          <span className="font-bold text-text-primary">
                            {item.unitName}
                          </span>
                        </div>
                      </td>

                      {/* Trainers */}
                      <td className="px-3 py-2.5 font-medium text-text-secondary">
                        {item.trainerNames.length > 0
                          ? item.trainerNames.join(', ')
                          : 'Unassigned'}
                      </td>

                      {/* Cohort */}
                      <td className="px-3 py-2.5 text-text-muted font-medium">
                        {item.cohortNames.join(', ') || '—'}
                      </td>

                      {/* Candidate Count */}
                      <td className="px-3 py-2.5 text-center font-bold text-text-primary">
                        {item.populationCount}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center">
                        {isSubmitted ? (
                          <Badge variant="success">Submitted</Badge>
                        ) : isDraft ? (
                          <Badge variant="institutional">Draft ({item.satCount})</Badge>
                        ) : (
                          <Badge variant="neutral">Pending</Badge>
                        )}
                      </td>

                      {/* Conditional Columns based on Tab */}
                      {activeTab === 'cat' ? (
                        <>
                          <td className="px-3 py-2.5 text-center font-bold text-text-primary">
                            {item.satCount} / {item.populationCount}
                          </td>
                          <td className="px-3 py-2.5 text-center text-text-muted">
                            {item.satCount > 0 ? '15%' : '—'}
                          </td>
                        </>
                      ) : activeTab === 'exam' ? (
                        <>
                          <td className="px-3 py-2.5 text-center font-bold text-text-primary">
                            {item.satCount} / {item.populationCount}
                          </td>
                          <td className="px-3 py-2.5 text-center text-text-muted">
                            {item.isFinalised ? 'Yes' : 'No'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-center font-bold text-text-primary">
                            {item.satCount}
                          </td>
                          <td className="px-3 py-2.5 text-center text-text-muted">
                            {item.missingCount > 0 ? (
                              <span className="font-bold text-warning">
                                {item.missingCount}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                        </>
                      )}

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/assessment/analysis/${item.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11px] font-bold text-text-secondary hover:bg-surface-subtle transition active:scale-95"
                          >
                            <BarChart3 className="size-3 text-primary" />
                            Analysis
                          </Link>
                          <Link
                            href={`/assessment/marks/${item.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-white shadow-2xs hover:bg-primary-hover transition active:scale-95"
                          >
                            Markbook
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
