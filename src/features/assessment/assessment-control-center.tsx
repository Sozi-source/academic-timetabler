'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Globe,
  Lock,
  Search,
  Unlock,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { MarkbookDeleteButton } from './markbook-delete-button';
import type {
  AssessmentControlCenterData,
  AssessmentControlCenterItem,
} from './control-center-queries';

type LifecycleFilter = 'all' | 'unlocked' | 'locked' | 'submitted' | 'finalised' | 'published' | 'missing';
type SourceFilter = 'all' | 'excel' | 'online' | 'pending';

export function AssessmentControlCenter({ data }: { data: AssessmentControlCenterData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      // 1. Search match
      const query = search.trim().toLowerCase();
      if (query) {
        const matchesUnit =
          item.unitCode.toLowerCase().includes(query) ||
          item.unitName.toLowerCase().includes(query);
        const matchesTrainer = item.trainerNames.some((t) =>
          t.toLowerCase().includes(query)
        );
        const matchesCohort = item.cohortNames.some((c) =>
          c.toLowerCase().includes(query)
        );
        if (!matchesUnit && !matchesTrainer && !matchesCohort) {
          return false;
        }
      }

      // 2. Lifecycle filter
      if (lifecycleFilter === 'unlocked' && item.populationLocked) return false;
      if (lifecycleFilter === 'locked' && !item.populationLocked) return false;
      if (lifecycleFilter === 'submitted' && !item.isSubmitted) return false;
      if (lifecycleFilter === 'finalised' && !item.isFinalised) return false;
      if (lifecycleFilter === 'published' && !item.isPublished) return false;
      if (lifecycleFilter === 'missing' && item.missingCount === 0) return false;

      // 3. Source filter
      if (sourceFilter === 'excel' && item.marksSource !== 'excel') return false;
      if (sourceFilter === 'online' && item.marksSource !== 'online') return false;
      if (sourceFilter === 'pending' && item.marksSource !== 'pending') return false;

      return true;
    });
  }, [data.items, search, lifecycleFilter, sourceFilter]);

  const handlePeriodChange = (periodId: string) => {
    router.push(`/assessment?periodId=${periodId}`);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        eyebrow="Assessment Operations"
        title="Assessment Control Centre"
        description="Departmental oversight for marks collection, population lock, verification, and publication."
        icon={ClipboardList}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              value={data.selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-7 rounded-md border border-border bg-surface px-2 text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/assessment/analysis"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Analysis
            </Link>
            <Link
              href="/assessment/reports"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              Reports
            </Link>
            <Link
              href="/assessment/assessments"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
            >
              Configure Markbooks
            </Link>
          </div>
        }
      />

      {/* Top Metrics Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Unit Markbooks"
          value={String(data.summary.totalMarkbooks)}
          description={`${data.summary.rosterLockedCount} locked · ${data.summary.rosterUnlockedCount} open`}
          icon={ClipboardList}
          status="Configured"
        />
        <MetricCard
          label="Roster Candidates"
          value={String(data.summary.totalPopulation)}
          description="Registered candidates snapshot"
          icon={UsersRound}
          status="Students"
        />
        <MetricCard
          label="Submitted Marks"
          value={String(data.summary.submittedCount)}
          description={`${data.summary.excelSourceCount} Excel · ${data.summary.onlineSourceCount} Online`}
          icon={FileSpreadsheet}
          status="Workflows"
        />
        <MetricCard
          label="Finalised & Published"
          value={`${data.summary.finalisedCount} / ${data.summary.publishedCount}`}
          description="Accepted / Released to students"
          icon={CheckCircle2}
          status="Results"
        />
        <MetricCard
          label="Missing Marks"
          value={String(data.summary.totalMissingMarks)}
          description={
            data.summary.totalMissingMarks > 0
              ? 'Entries requiring resolution'
              : 'All candidate marks accounted'
          }
          icon={AlertTriangle}
          status={data.summary.totalMissingMarks > 0 ? 'Action Needed' : 'Clean'}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by unit code, title, trainer, or cohort..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lifecycle Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-text-muted">Status:</span>
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value as LifecycleFilter)}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Stages ({data.items.length})</option>
                <option value="unlocked">Roster Open ({data.summary.rosterUnlockedCount})</option>
                <option value="locked">Roster Locked ({data.summary.rosterLockedCount})</option>
                <option value="submitted">Submitted ({data.summary.submittedCount})</option>
                <option value="finalised">Finalised ({data.summary.finalisedCount})</option>
                <option value="published">Published ({data.summary.publishedCount})</option>
                <option value="missing">With Missing Marks</option>
              </select>
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-text-muted">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Sources</option>
                <option value="excel">Excel Markbook</option>
                <option value="online">Online Entry</option>
                <option value="pending">Pending / No Marks</option>
              </select>
            </div>

            {(search || lifecycleFilter !== 'all' || sourceFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setLifecycleFilter('all');
                  setSourceFilter('all');
                }}
                className="h-8 rounded-lg border border-border px-2.5 text-xs font-semibold text-text-muted hover:bg-surface-subtle hover:text-text-primary"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Assessment Control Table */}
      <Card className="overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ClipboardList className="mx-auto size-8 text-text-muted opacity-40" />
            <p className="mt-2 text-sm font-semibold text-text-primary">
              No assessment markbooks match your criteria
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {data.items.length === 0
                ? 'No unit markbooks are configured for this academic period.'
                : 'Try adjusting your search query or status filters.'}
            </p>
            {data.items.length === 0 && (
              <Link
                href="/assessment/assessments"
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                Create First Unit Markbook
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-3 py-3">Assigned Trainer(s)</th>
                  <th className="px-3 py-3">Population</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Marks Progress</th>
                  <th className="px-3 py-3">Lifecycle State</th>
                  <th className="px-4 py-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="transition hover:bg-surface-subtle/50">
                    {/* Unit & Cohorts */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-text-primary">
                        <Link
                          href={`/assessment/marks/${item.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {item.unitCode}
                        </Link>
                      </div>
                      <div className="text-[11px] text-text-secondary truncate max-w-xs">
                        {item.unitName}
                      </div>
                      {item.cohortNames.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.cohortNames.map((c) => (
                            <span
                              key={c}
                              className="rounded bg-surface-subtle px-1.5 py-0.5 text-[9px] font-medium text-text-muted"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Trainer(s) */}
                    <td className="px-3 py-3">
                      {item.trainerNames.length > 0 ? (
                        <div className="space-y-0.5">
                          {item.trainerNames.map((t) => (
                            <div key={t} className="text-xs font-medium text-text-primary">
                              {t}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-text-muted">Unassigned</span>
                      )}
                    </td>

                    {/* Population & Roster Lock */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">
                          {item.populationCount}
                        </span>
                        {item.populationLocked ? (
                          <span
                            title="Roster snapshot locked for marks processing"
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success"
                          >
                            <Lock className="size-3" aria-hidden="true" />
                            Locked
                          </span>
                        ) : (
                          <span
                            title="Roster snapshot is open / auto-refreshes"
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-warning"
                          >
                            <Unlock className="size-3" aria-hidden="true" />
                            Open
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/assessment/population/${item.id}`}
                        className="mt-0.5 inline-block text-[10px] font-semibold text-primary hover:underline"
                      >
                        Manage Roster
                      </Link>
                    </td>

                    {/* Marks Source */}
                    <td className="px-3 py-3">
                      {item.marksSource === 'excel' ? (
                        <Badge variant="institutional" className="gap-1">
                          <FileSpreadsheet className="size-3" aria-hidden="true" />
                          Excel
                        </Badge>
                      ) : item.marksSource === 'online' ? (
                        <Badge variant="info" className="gap-1">
                          <Globe className="size-3" aria-hidden="true" />
                          Online
                        </Badge>
                      ) : item.marksSource === 'mixed' ? (
                        <Badge variant="primary">Mixed</Badge>
                      ) : (
                        <Badge variant="neutral">Pending</Badge>
                      )}
                    </td>

                    {/* Marks Progress */}
                    <td className="px-3 py-3">
                      {item.totalExpected > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-text-primary">
                              {item.satCount + item.absentCount} / {item.totalExpected}
                            </span>
                            {item.missingCount > 0 ? (
                              <span className="font-bold text-danger">
                                {item.missingCount} missing
                              </span>
                            ) : (
                              <span className="font-bold text-success">Complete</span>
                            )}
                          </div>
                          {/* Visual Progress Bar */}
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                            <div
                              style={{
                                width: `${(item.satCount / item.totalExpected) * 100}%`,
                              }}
                              className="bg-primary"
                              title={`${item.satCount} Sat`}
                            />
                            <div
                              style={{
                                width: `${(item.absentCount / item.totalExpected) * 100}%`,
                              }}
                              className="bg-danger"
                              title={`${item.absentCount} Absent`}
                            />
                          </div>
                          <div className="text-[9px] text-text-muted">
                            {item.satCount} sat · {item.absentCount} absent
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-muted">No students</span>
                      )}
                    </td>

                    {/* Lifecycle State */}
                    <td className="px-3 py-3">
                      {item.isPublished ? (
                        <Badge variant="success">Published</Badge>
                      ) : item.isFinalised ? (
                        <Badge variant="success">Finalised</Badge>
                      ) : item.isSubmitted ? (
                        <Badge variant="primary">Submitted</Badge>
                      ) : (
                        <Badge variant="neutral">Draft / Open</Badge>
                      )}
                      {item.submittedAt && !item.isFinalised && (
                        <div className="mt-0.5 text-[9px] text-text-muted">
                          Awaiting HOD review
                        </div>
                      )}
                    </td>

                    {/* Quick Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/assessment/marks/${item.id}`}
                          className="inline-flex h-7 items-center rounded-md border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
                        >
                          Markbook
                        </Link>
                        <Link
                          href={`/assessment/analysis/${item.analysisId}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                          title="View Analysis"
                        >
                          <BarChart3 className="size-3" aria-hidden="true" />
                          Analysis
                        </Link>
                        <MarkbookDeleteButton
                          assessmentId={item.id}
                          unitLabel={`${item.unitCode} — ${item.unitName}`}
                        />
                      </div>
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
