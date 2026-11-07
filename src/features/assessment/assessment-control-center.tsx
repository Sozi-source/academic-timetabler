'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Lock,
  Search,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminDepartmentMarksEntryControl } from './admin-department-marks-entry-control';
import type {
  AssessmentControlCenterData,
  AssessmentControlCenterItem,
  AssessmentSubmissionTrackerRow,
} from './control-center-queries';

type StatusPillVariant = 'success' | 'warning' | 'neutral' | 'purple' | 'closed';

function StatusPill({
  label,
  variant,
  icon = 'dot',
  subtext,
}: {
  label: string;
  variant: StatusPillVariant;
  icon?: 'check' | 'clock' | 'lock' | 'dot';
  subtext?: string | null;
}) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    closed: 'bg-slate-100 text-slate-500 border-slate-200',
  }[variant];

  const dotStyles = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    neutral: 'bg-slate-400',
    purple: 'bg-purple-500',
    closed: 'bg-slate-400',
  }[variant];

  return (
    <div className="inline-flex flex-col items-start whitespace-nowrap">
      <span
        className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap shadow-2xs ${styles}`}
      >
        {icon === 'check' ? (
          <CheckCircle2 className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : icon === 'clock' ? (
          <Clock className="size-3 shrink-0 text-amber-600" aria-hidden="true" />
        ) : icon === 'lock' ? (
          <Lock className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <span className={`size-1.5 shrink-0 rounded-full ${dotStyles}`} aria-hidden="true" />
        )}
        <span>{label}</span>
      </span>
      {subtext ? <span className="mt-0.5 text-[10px] text-slate-400">{subtext}</span> : null}
    </div>
  );
}

interface UnifiedUnitDeliverable {
  key: string;
  unitId: string;
  unitCode: string;
  unitCodes: string[];
  unitName: string;
  cohortNames: string[];
  trainerNames: string[];
  registrationCount: number;
  items: AssessmentControlCenterItem[];
  catStatus: 'Submitted' | 'In Progress' | 'Not Started';
  catSubmittedCount: number;
  catSubmittedAt: string | null;
  catSubmittedBy: string | null;
  examStatus: 'Submitted' | 'In Progress' | 'Closed' | 'Not Started';
  examSubmittedCount: number;
  examSubmittedAt: string | null;
  examSubmittedBy: string | null;
  workflowStatus: 'Finalised' | 'Submitted' | 'In Progress' | 'Open';
  isComplete: boolean;
  needsAttention: boolean;
}

export function AssessmentControlCenter({ data }: { data: AssessmentControlCenterData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCohort, setFilterCohort] = useState('all');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);

  // Map submissions by assessmentId and component for instant lookup
  const submissionsByAssessmentId = useMemo(() => {
    const map = new Map<string, Map<string, AssessmentSubmissionTrackerRow>>();
    for (const sub of data.submissions) {
      let forEvent = map.get(sub.assessmentId);
      if (!forEvent) {
        forEvent = new Map();
        map.set(sub.assessmentId, forEvent);
      }
      forEvent.set(sub.component.toUpperCase(), sub);
    }
    return map;
  }, [data.submissions]);

  // Aggregate assessment items by unit / equivalence group into clean, single-row deliverables
  const unifiedUnits = useMemo<UnifiedUnitDeliverable[]>(() => {
    const byUnit = new Map<string, {
      unitId: string;
      unitIds: Set<string>;
      unitCode: string;
      unitCodes: Set<string>;
      unitName: string;
      trainerNames: Set<string>;
      cohortNames: Set<string>;
      registrationCount: number;
      items: AssessmentControlCenterItem[];
    }>();

    for (const item of data.items) {
      const groupKey = item.equivalenceGroupId ? `equivalence:${item.equivalenceGroupId}` : `unit:${item.unitId}`;
      let group = byUnit.get(groupKey);
      if (!group) {
        group = {
          unitId: item.unitId,
          unitIds: new Set(item.equivalentUnitIds),
          unitCode: item.equivalentUnitCodes[0] ?? item.unitCode,
          unitCodes: new Set(item.equivalentUnitCodes.length ? item.equivalentUnitCodes : [item.unitCode]),
          unitName: item.canonicalUnitName ?? item.unitName,
          trainerNames: new Set<string>(),
          cohortNames: new Set<string>(),
          registrationCount: 0,
          items: [],
        };
        byUnit.set(groupKey, group);
      }

      item.equivalentUnitIds.forEach((uid) => group?.unitIds.add(uid));
      item.equivalentUnitCodes.forEach((code) => group?.unitCodes.add(code));
      if (item.canonicalUnitName) group.unitName = item.canonicalUnitName;
      item.trainerNames.forEach((trainer) => group?.trainerNames.add(trainer));
      if (item.cohortName) group.cohortNames.add(item.cohortName);
      group.items.push(item);
      group.registrationCount = Math.max(
        group.registrationCount,
        ...[...group.unitIds].map((uid) => data.unitRegistrationCounts[uid] ?? 0),
      );
    }

    return [...byUnit.entries()].map(([groupKey, group]) => {
      let catSubmittedCount = 0;
      let catInProgressCount = 0;
      let examSubmittedCount = 0;
      let examInProgressCount = 0;
      let latestCatSubmittedAt: string | null = null;
      let latestCatSubmittedBy: string | null = null;
      let latestExamSubmittedAt: string | null = null;
      let latestExamSubmittedBy: string | null = null;

      for (const it of group.items) {
        const eventSubs = submissionsByAssessmentId.get(it.id);
        const catSub = eventSubs?.get('CAT');
        const examSub = eventSubs?.get('EXAM');

        // Check if any coursework sub-component has progress
        const courseworkHasProgress = ['ASSIGNMENT', 'PRESENTATION', 'RAT', 'CAT'].some((comp) => {
          const s = eventSubs?.get(comp);
          return s && s.status !== 'Not started';
        });

        const isCatSub = it.isSubmitted || it.isFinalised || catSub?.status === 'Submitted';
        const isCatProg = !isCatSub && (catSub?.status === 'In progress' || courseworkHasProgress || it.satCount > 0);

        if (isCatSub) {
          catSubmittedCount++;
          if (catSub?.submittedAt && (!latestCatSubmittedAt || catSub.submittedAt > latestCatSubmittedAt)) {
            latestCatSubmittedAt = catSub.submittedAt;
            latestCatSubmittedBy = catSub.submittedBy;
          }
        } else if (isCatProg) {
          catInProgressCount++;
        }

        const isExamSub = it.isFinalised || it.isSubmitted || examSub?.status === 'Submitted';
        const isExamProg = !isExamSub && (examSub?.status === 'In progress');

        if (isExamSub) {
          examSubmittedCount++;
          if (examSub?.submittedAt && (!latestExamSubmittedAt || examSub.submittedAt > latestExamSubmittedAt)) {
            latestExamSubmittedAt = examSub.submittedAt;
            latestExamSubmittedBy = examSub.submittedBy;
          }
        } else if (isExamProg) {
          examInProgressCount++;
        }
      }

      const totalItems = group.items.length;
      let catStatus: 'Submitted' | 'In Progress' | 'Not Started' = 'Not Started';
      if (catSubmittedCount > 0 && catSubmittedCount === totalItems) {
        catStatus = 'Submitted';
      } else if (catSubmittedCount > 0 || catInProgressCount > 0) {
        catStatus = 'In Progress';
      }

      const allExamClosed = group.items.every((it) => !it.trainerExamEntryOpen);
      let examStatus: 'Submitted' | 'In Progress' | 'Closed' | 'Not Started' = 'Not Started';
      if (examSubmittedCount > 0 && examSubmittedCount === totalItems) {
        examStatus = 'Submitted';
      } else if (examSubmittedCount > 0 || examInProgressCount > 0) {
        examStatus = 'In Progress';
      } else if (allExamClosed) {
        examStatus = 'Closed';
      }

      const allFinalised = group.items.length > 0 && group.items.every((it) => it.isFinalised);
      const allSubmitted = group.items.length > 0 && (allFinalised || (catSubmittedCount === totalItems && examSubmittedCount === totalItems));
      const hasAnyProgress = catSubmittedCount > 0 || catInProgressCount > 0 || examSubmittedCount > 0 || examInProgressCount > 0;

      let workflowStatus: 'Finalised' | 'Submitted' | 'In Progress' | 'Open' = 'Open';
      if (allFinalised) {
        workflowStatus = 'Finalised';
      } else if (allSubmitted) {
        workflowStatus = 'Submitted';
      } else if (hasAnyProgress) {
        workflowStatus = 'In Progress';
      }

      const isComplete = allFinalised || allSubmitted;
      const needsAttention = !isComplete && (catStatus !== 'Submitted' || examStatus === 'In Progress');

      return {
        key: groupKey,
        unitId: group.unitId,
        unitCode: [...group.unitCodes].join(' · '),
        unitCodes: [...group.unitCodes],
        unitName: group.unitName,
        cohortNames: [...group.cohortNames].sort(),
        trainerNames: [...group.trainerNames],
        registrationCount: group.registrationCount,
        items: group.items,
        catStatus,
        catSubmittedCount,
        catSubmittedAt: latestCatSubmittedAt,
        catSubmittedBy: latestCatSubmittedBy,
        examStatus,
        examSubmittedCount,
        examSubmittedAt: latestExamSubmittedAt,
        examSubmittedBy: latestExamSubmittedBy,
        workflowStatus,
        isComplete,
        needsAttention,
      };
    }).sort((a, b) => a.unitCode.localeCompare(b.unitCode));
  }, [data.items, data.unitRegistrationCounts, submissionsByAssessmentId]);

  // Distinct cohort list for filtering
  const allCohorts = useMemo(() => {
    const set = new Set<string>();
    for (const item of data.items) {
      if (item.cohortName) set.add(item.cohortName);
    }
    return [...set].sort();
  }, [data.items]);

  // Filtered deliverables list
  const filteredUnits = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return unifiedUnits.filter((unit) => {
      if (needsAttentionOnly && !unit.needsAttention) return false;
      if (filterCohort !== 'all' && !unit.cohortNames.includes(filterCohort)) return false;

      if (filterStatus === 'needs-attention' && !unit.needsAttention) return false;
      if (filterStatus === 'cat-submitted' && unit.catStatus !== 'Submitted') return false;
      if (filterStatus === 'exam-submitted' && unit.examStatus !== 'Submitted') return false;
      if (filterStatus === 'completed' && !unit.isComplete) return false;
      if (filterStatus === 'not-started' && (unit.catStatus !== 'Not Started' || unit.examStatus === 'Submitted')) return false;

      if (!query) return true;
      const cohortStr = unit.cohortNames.join(' ').toLocaleLowerCase();
      const trainerStr = unit.trainerNames.join(' ').toLocaleLowerCase();
      return (
        unit.unitName.toLocaleLowerCase().includes(query) ||
        unit.unitCode.toLocaleLowerCase().includes(query) ||
        cohortStr.includes(query) ||
        trainerStr.includes(query)
      );
    });
  }, [filterCohort, filterStatus, needsAttentionOnly, search, unifiedUnits]);

  const totalCurrentRegistrations = useMemo(() => {
    return unifiedUnits.reduce((total, group) => total + group.registrationCount, 0);
  }, [unifiedUnits]);

  const handlePeriodChange = (periodId: string) => {
    router.push(`/assessment?periodId=${periodId}`);
  };

  const statCards = [
    { label: 'Units', value: unifiedUnits.length, note: data.selectedPeriodName, icon: ClipboardList },
    { label: 'Current unit registrations', value: totalCurrentRegistrations, note: 'Each student is counted once per registered unit', icon: UsersRound },
    { label: 'Submitted markbooks', value: `${data.summary.submittedCount} / ${data.summary.totalMarkbooks}`, note: 'Marks submitted for HOD review', icon: GraduationCap },
  ];

  return (
    <div className="space-y-4 pb-10 text-slate-700">
      <PageHeader
        title="Results & Exams Analysis"
        icon={GraduationCap}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              aria-label="Academic period"
              value={data.selectedPeriodId}
              onChange={(event) => handlePeriodChange(event.target.value)}
              className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-slate-600 shadow-2xs focus:border-primary focus:outline-none"
            >
              {data.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} {period.status === 'active' ? '(Active)' : `(${period.status})`}
                </option>
              ))}
            </select>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-slate-600 shadow-2xs transition hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" />
              Operations
            </Link>
            <Link
              href="/assessment/reports"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-slate-600 shadow-2xs transition hover:bg-surface-subtle"
            >
              <FileSpreadsheet className="size-3.5" />
              Consolidated Marksheets
            </Link>
          </div>
        }
      />

      {/* Department Marks Entry Windows Administration */}
      <section
        aria-label="Department marks entry windows"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-2xs lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-200/80">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">Department Marks Entry Windows</h2>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                {data.summary.totalMarkbooks} unit cohorts
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Control trainer marks submission windows for Continuous Assessment (CAT) and Final Examinations
            </p>
          </div>
        </div>

        <AdminDepartmentMarksEntryControl
          periodId={data.selectedPeriodId}
          isOpen={data.marksEntryStatus.isOpen}
          openCount={data.marksEntryStatus.openCount}
          totalCount={data.marksEntryStatus.totalCount}
          cat={data.marksEntryStatus.cat}
          exam={data.marksEntryStatus.exam}
        />
      </section>

      {/* Summary KPI Cards */}
      <section aria-label="Assessment summary" className="grid gap-3 sm:grid-cols-3">
        {statCards.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-2xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-0.5 text-xl font-semibold leading-6 tabular-nums text-slate-700">{value}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{note}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Master Assessment Deliverables Tracker */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Assessment Deliverables & Submissions</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filteredUnits.length} {filteredUnits.length === 1 ? 'unit' : 'units'} · Monitor Continuous Assessment (CAT) and Final Examination milestones
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNeedsAttentionOnly((current) => !current)}
            aria-pressed={needsAttentionOnly}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
              needsAttentionOnly
                ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-2xs'
                : 'border-border bg-surface text-slate-600 hover:bg-surface-subtle'
            }`}
          >
            <Clock className="size-3.5" />
            Needs attention
          </button>
        </div>

        {/* Filters bar */}
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(200px,1fr)_160px_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search unit name, code, cohort, or trainer..."
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-slate-600 placeholder:text-slate-400 outline-none focus:border-primary"
            />
          </label>
          <select
            aria-label="Filter by milestone status"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-slate-600 focus:border-primary focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="needs-attention">Needs attention</option>
            <option value="cat-submitted">CAT Submitted</option>
            <option value="exam-submitted">Exam Submitted</option>
            <option value="completed">Completed / Finalised</option>
            <option value="not-started">Not started</option>
          </select>
          <select
            aria-label="Filter by cohort"
            value={filterCohort}
            onChange={(event) => setFilterCohort(event.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-slate-600 focus:border-primary focus:outline-none"
          >
            <option value="all">All cohorts</option>
            {allCohorts.map((cohort) => (
              <option key={cohort} value={cohort}>
                {cohort}
              </option>
            ))}
          </select>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No units match these filters.</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search or clearing active filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (sm and down) */}
            <div className="divide-y divide-border md:hidden">
              {filteredUnits.map((unit) => (
                <article key={unit.key} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{unit.unitName}</p>
                      <p className="font-mono text-xs font-medium text-slate-500">{unit.unitCode}</p>
                    </div>
                    <StatusPill
                      label={unit.workflowStatus}
                      variant={
                        unit.workflowStatus === 'Finalised'
                          ? 'purple'
                          : unit.workflowStatus === 'Submitted'
                            ? 'success'
                            : unit.workflowStatus === 'In Progress'
                              ? 'warning'
                              : 'neutral'
                      }
                      icon={
                        unit.workflowStatus === 'Finalised' || unit.workflowStatus === 'Submitted'
                          ? 'check'
                          : unit.workflowStatus === 'In Progress'
                            ? 'clock'
                            : 'dot'
                      }
                    />
                  </div>

                  {/* Cohorts & Trainer */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {unit.cohortNames.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200"
                      >
                        {c}
                      </span>
                    ))}
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-600">{unit.trainerNames.join(', ') || 'Unassigned'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-700">{unit.registrationCount} candidates</span>
                  </div>

                  {/* Milestone status row */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-subtle p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CAT Milestone</span>
                      <div className="mt-1">
                        {unit.catStatus === 'Submitted' ? (
                          <StatusPill label="Submitted" variant="success" icon="check" />
                        ) : unit.catStatus === 'In Progress' ? (
                          <StatusPill
                            label={unit.catSubmittedCount > 0 ? `${unit.catSubmittedCount}/${unit.items.length} Submitted` : 'In Progress'}
                            variant="warning"
                            icon="clock"
                          />
                        ) : (
                          <StatusPill label="Not Started" variant="neutral" icon="dot" />
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Final Exam</span>
                      <div className="mt-1">
                        {unit.examStatus === 'Submitted' ? (
                          <StatusPill label="Submitted" variant="success" icon="check" />
                        ) : unit.examStatus === 'In Progress' ? (
                          <StatusPill label="In Progress" variant="warning" icon="clock" />
                        ) : unit.examStatus === 'Closed' ? (
                          <StatusPill label="Closed" variant="closed" icon="lock" />
                        ) : (
                          <StatusPill label="Not Started" variant="neutral" icon="dot" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Action Link */}
                  {unit.items.length <= 1 ? (
                    <Link
                      href={`/assessment/marks/${unit.items[0]?.id ?? unit.unitId}`}
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-subtle transition"
                    >
                      Open Markbook
                      <ArrowRight className="size-3.5 text-slate-400" />
                    </Link>
                  ) : (
                    <Link
                      href={`/assessment/unit/${unit.unitId}?periodId=${data.selectedPeriodId}`}
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-surface-subtle transition"
                    >
                      View Cohort Markbooks ({unit.items.length})
                      <ArrowRight className="size-3.5 text-slate-400" />
                    </Link>
                  )}
                </article>
              ))}
            </div>

            {/* Desktop Table (md and up) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[840px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Unit name & code</th>
                    <th className="px-3 py-3">Cohorts</th>
                    <th className="px-3 py-3">Lead trainer</th>
                    <th className="px-3 py-3 text-center">Candidates</th>
                    <th className="px-3 py-3 whitespace-nowrap">CAT milestone</th>
                    <th className="px-3 py-3 whitespace-nowrap">Final exam</th>
                    <th className="px-3 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUnits.map((unit) => (
                    <tr key={unit.key} className="transition-colors hover:bg-surface-subtle/50">
                      {/* Unit name & code */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {unit.unitName}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] font-medium text-slate-400">
                          {unit.unitCode}
                        </div>
                      </td>

                      {/* Clean Cohorts Display */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {unit.cohortNames.length === 0 ? (
                            <span className="text-slate-400 text-xs">All cohorts</span>
                          ) : (
                            unit.cohortNames.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200/80"
                              >
                                {c}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Lead Trainer */}
                      <td className="px-3 py-3">
                        {unit.trainerNames.length > 0 ? (
                          <span className="font-medium text-slate-700 text-xs" title={unit.trainerNames.join(', ')}>
                            {unit.trainerNames.join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Candidates Count */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold tabular-nums text-slate-800 text-xs">
                          {unit.registrationCount}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400">students</span>
                      </td>

                      {/* CAT Milestone */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {unit.catStatus === 'Submitted' ? (
                          <StatusPill
                            label="Submitted"
                            variant="success"
                            icon="check"
                            subtext={
                              unit.catSubmittedAt
                                ? `${new Date(unit.catSubmittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${unit.catSubmittedBy ? ` · ${unit.catSubmittedBy}` : ''}`
                                : null
                            }
                          />
                        ) : unit.catStatus === 'In Progress' ? (
                          <StatusPill
                            label={
                              unit.catSubmittedCount > 0
                                ? `${unit.catSubmittedCount}/${unit.items.length} Submitted`
                                : 'In Progress'
                            }
                            variant="warning"
                            icon="clock"
                          />
                        ) : (
                          <StatusPill label="Not Started" variant="neutral" icon="dot" />
                        )}
                      </td>

                      {/* Final Exam Milestone */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {unit.examStatus === 'Submitted' ? (
                          <StatusPill
                            label="Submitted"
                            variant="success"
                            icon="check"
                            subtext={
                              unit.examSubmittedAt
                                ? `${new Date(unit.examSubmittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${unit.examSubmittedBy ? ` · ${unit.examSubmittedBy}` : ''}`
                                : null
                            }
                          />
                        ) : unit.examStatus === 'In Progress' ? (
                          <StatusPill label="In Progress" variant="warning" icon="clock" />
                        ) : unit.examStatus === 'Closed' ? (
                          <StatusPill label="Closed" variant="closed" icon="lock" />
                        ) : (
                          <StatusPill label="Not Started" variant="neutral" icon="dot" />
                        )}
                      </td>

                      {/* Workflow Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusPill
                          label={unit.workflowStatus}
                          variant={
                            unit.workflowStatus === 'Finalised'
                              ? 'purple'
                              : unit.workflowStatus === 'Submitted'
                                ? 'success'
                                : unit.workflowStatus === 'In Progress'
                                  ? 'warning'
                                  : 'neutral'
                          }
                          icon={
                            unit.workflowStatus === 'Finalised' || unit.workflowStatus === 'Submitted'
                              ? 'check'
                              : unit.workflowStatus === 'In Progress'
                                ? 'clock'
                                : 'dot'
                          }
                        />
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        {unit.items.length <= 1 ? (
                          <Link
                            href={`/assessment/marks/${unit.items[0]?.id ?? unit.unitId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition"
                          >
                            Open Markbook
                            <ArrowRight className="size-3 text-slate-400" />
                          </Link>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition"
                              >
                                Open Markbook
                                <ChevronDown className="size-3 text-slate-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-1.5">
                              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Select Cohort Markbook
                              </div>
                              {unit.items.map((it) => (
                                <DropdownMenuItem key={it.id} asChild>
                                  <Link
                                    href={`/assessment/marks/${it.id}`}
                                    className="flex w-full items-center justify-between text-xs font-medium cursor-pointer"
                                  >
                                    <span>{it.cohortName}</span>
                                    <span className="text-[10px] text-slate-400">{it.totalExpected} std</span>
                                  </Link>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/assessment/unit/${unit.unitId}?periodId=${data.selectedPeriodId}`}
                                  className="flex w-full items-center text-xs font-medium text-primary cursor-pointer"
                                >
                                  View Cohorts & Rosters
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
