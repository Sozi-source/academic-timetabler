'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Percent,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import type {
  AssessmentControlCenterData,
  AssessmentControlCenterItem,
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
  const participationRate = totalCandidates > 0 ? Math.round((totalSat / totalCandidates) * 100) : 0;

  return (
    <div className="space-y-5 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Results & Exams Analysis"
        description="Departmental assessment performance, CAT score tracking, and final exam analytics."
        icon={GraduationCap}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              value={data.selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-slate-400 focus:outline-none"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5 text-slate-500" />
              <span>Operations</span>
            </Link>
            <Link
              href="/assessment/reports"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <FileText className="size-3.5 text-slate-500" />
              <span>Examination Reports Centre</span>
            </Link>
          </div>
        }
      />

      {/* Top 4 Analytics Telemetry Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Allocated Units */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Allocated Units
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <ClipboardList className="size-4 text-[#033B36]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {totalUnits} Units
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{data.selectedPeriodName}</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>

        {/* Metric 2: Submissions */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#15803D]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Submitted Markbooks
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {submittedUnits} / {totalUnits} ({submissionRate}%)
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {inProgressUnits} in draft · {pendingUnits} pending
            </p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#15803D]" />
        </div>

        {/* Metric 3: Candidate Population */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#F59E0B]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Total Candidates
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#D97706]">
              <UsersRound className="size-4 text-[#D97706]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {totalCandidates} Enrolled
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Across all cohorts in term</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#F59E0B]" />
        </div>

        {/* Metric 4: Marks Sat */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Assessment Sittings
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <BarChart3 className="size-4 text-[#033B36]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {totalSat} Completed
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Continuous & Exam entries</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>
      </div>

      {/* Analysis Tabs & Filter Strip */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
          {/* Analysis Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-3 py-1.5 font-bold transition ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Markbooks ({data.items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cat')}
              className={`rounded-md px-3 py-1.5 font-bold transition ${
                activeTab === 'cat'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CAT Analysis (/15)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exam')}
              className={`rounded-md px-3 py-1.5 font-bold transition ${
                activeTab === 'exam'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exam Analysis (/70 & /100)
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-slate-400"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted Only</option>
              <option value="draft">In Draft</option>
              <option value="pending">Pending</option>
            </select>

            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search unit or trainer..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none focus:border-slate-400"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Units Table / List */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-slate-400" />
            <p className="mt-2 text-xs font-bold text-slate-800">
              {search ? `No units match "${search}"` : 'No units found for this period'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="px-3.5 py-2.5">Unit Code & Title</th>
                  <th className="px-3 py-2.5">Trainer(s)</th>
                  <th className="px-3 py-2.5">Cohort</th>
                  <th className="px-3 py-2.5 text-center">Candidates</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  {activeTab === 'cat' ? (
                    <>
                      <th className="px-3 py-2.5 text-center">CAT Sat</th>
                      <th className="px-3 py-2.5 text-center">CAT Max /15</th>
                    </>
                  ) : activeTab === 'exam' ? (
                    <>
                      <th className="px-3 py-2.5 text-center">Exam Sat</th>
                      <th className="px-3 py-2.5 text-center">Finalized</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-center">Sat Count</th>
                      <th className="px-3 py-2.5 text-center">Missing</th>
                    </>
                  )}
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isSubmitted = item.isSubmitted;
                  const isDraft = !isSubmitted && item.satCount > 0;
                  const isPending = item.satCount === 0;

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/60"
                    >
                      {/* Unit Code & Title */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {item.unitCode}
                          </span>
                          <span className="font-bold text-slate-900">
                            {item.unitName}
                          </span>
                        </div>
                      </td>

                      {/* Trainers */}
                      <td className="px-3 py-3 text-slate-600">
                        {item.trainerNames.length > 0
                          ? item.trainerNames.join(', ')
                          : 'Unassigned'}
                      </td>

                      {/* Cohort */}
                      <td className="px-3 py-3 text-slate-600">
                        {item.cohortNames.join(', ') || '—'}
                      </td>

                      {/* Candidate Count */}
                      <td className="px-3 py-3 text-center font-semibold text-slate-900">
                        {item.populationCount}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center">
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                            <CheckCircle2 className="size-3 text-slate-600" />
                            Submitted
                          </span>
                        ) : isDraft ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            In Draft ({item.satCount})
                          </span>
                        ) : (
                          <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Conditional Columns based on Tab */}
                      {activeTab === 'cat' ? (
                        <>
                          <td className="px-3 py-3 text-center font-medium text-slate-800">
                            {item.satCount} / {item.populationCount}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-600">
                            {item.satCount > 0 ? '15%' : '—'}
                          </td>
                        </>
                      ) : activeTab === 'exam' ? (
                        <>
                          <td className="px-3 py-3 text-center font-medium text-slate-800">
                            {item.satCount} / {item.populationCount}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-600">
                            {item.isFinalised ? 'Yes' : 'No'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-center font-medium text-slate-800">
                            {item.satCount}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-500">
                            {item.missingCount > 0 ? (
                              <span className="font-semibold text-slate-700">
                                {item.missingCount}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                        </>
                      )}

                      {/* Actions */}
                      <td className="px-3.5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/assessment/analysis/${item.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <BarChart3 className="size-3" />
                            Analysis
                          </Link>
                          <Link
                            href={`/assessment/marks/${item.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
