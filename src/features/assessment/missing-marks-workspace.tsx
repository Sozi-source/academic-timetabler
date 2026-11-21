'use client';

import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileWarning,
  Printer,
  Search,
  UserX,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';

import type {
  ComponentMarkStatus,
  MissingMarkPeriodOption,
  MissingMarkRecord,
} from './missing-marks';

type ViewMode = 'student' | 'unit';
type IssueFilter =
  | 'all'
  | 'cat_absent'
  | 'exam_absent'
  | 'cat_missing'
  | 'exam_missing'
  | 'both';

interface MissingMarksWorkspaceProps {
  departmentName: string;
  periods: MissingMarkPeriodOption[];
  selectedPeriodId: string | null;
  selectedPeriodName: string;
  records: MissingMarkRecord[];
}

function formatComponentDisplay(
  status: ComponentMarkStatus,
  mark: number | null,
  active: boolean,
): string {
  if (!active) return '—';
  if (status === 'absent') return 'AB';
  if (status === 'present' && mark !== null) return String(mark);
  return 'Missing';
}

function StatusPill({
  status,
  mark,
  active,
}: {
  status: ComponentMarkStatus;
  mark: number | null;
  active: boolean;
}) {
  if (!active) {
    return <span className="text-slate-300">—</span>;
  }
  if (status === 'absent') {
    return (
      <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
        AB
      </span>
    );
  }
  if (status === 'present' && mark !== null) {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
        {mark}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      Missing
    </span>
  );
}

export function MissingMarksWorkspace({
  departmentName,
  periods,
  selectedPeriodId,
  selectedPeriodName,
  records,
}: MissingMarksWorkspaceProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [search, setSearch] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [includeUnstarted, setIncludeUnstarted] = useState(false);
  const [exporting, setExporting] = useState(false);

  const programmes = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.programmeCode && r.programmeCode !== '—') set.add(r.programmeCode);
    }
    return Array.from(set).sort();
  }, [records]);

  const cohorts = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      if (programmeFilter !== 'all' && r.programmeCode !== programmeFilter) continue;
      if (r.cohortName) map.set(r.cohortName, r.cohortName);
    }
    return Array.from(map.values()).sort();
  }, [records, programmeFilter]);

  const units = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const r of records) {
      if (programmeFilter !== 'all' && r.programmeCode !== programmeFilter) continue;
      if (!map.has(r.unitCode)) {
        map.set(r.unitCode, { code: r.unitCode, name: r.unitName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [records, programmeFilter]);

  const activeRecords = useMemo(() => {
    return records.filter((r) => {
      const catFlagged =
        r.catStatus === 'absent' ||
        (r.catStatus === 'missing' && (includeUnstarted || r.catMarkingStarted));
      // Only flag Exam absences/missing marks once Exam marks have been submitted for that unit
      const examFlagged =
        r.examSubmitted && (r.examStatus === 'absent' || r.examStatus === 'missing');
      return catFlagged || examFlagged;
    });
  }, [records, includeUnstarted]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeRecords.filter((r) => {
      if (programmeFilter !== 'all' && r.programmeCode !== programmeFilter) return false;
      if (cohortFilter !== 'all' && r.cohortName !== cohortFilter) return false;
      if (unitFilter !== 'all' && r.unitCode !== unitFilter) return false;

      const catMissingActive = r.catStatus === 'missing' && (includeUnstarted || r.catMarkingStarted);
      const examAbsentActive = r.examSubmitted && r.examStatus === 'absent';
      const examMissingActive = r.examSubmitted && r.examStatus === 'missing';
      const hasCatIssue = r.catStatus === 'absent' || catMissingActive;
      const hasExamIssue = examAbsentActive || examMissingActive;

      if (issueFilter === 'cat_absent' && r.catStatus !== 'absent') return false;
      if (issueFilter === 'exam_absent' && !examAbsentActive) return false;
      if (issueFilter === 'cat_missing' && !catMissingActive) return false;
      if (issueFilter === 'exam_missing' && !examMissingActive) return false;
      if (issueFilter === 'both' && !(hasCatIssue && hasExamIssue)) return false;

      if (q) {
        const hay = `${r.admissionNumber} ${r.fullName} ${r.unitCode} ${r.unitName} ${r.cohortName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [activeRecords, search, programmeFilter, cohortFilter, unitFilter, issueFilter, includeUnstarted]);

  const groupedByStudent = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        fullName: string;
        programmeCode: string;
        cohortName: string;
        items: MissingMarkRecord[];
      }
    >();

    for (const r of filteredRecords) {
      const existing = map.get(r.studentId);
      if (!existing) {
        map.set(r.studentId, {
          studentId: r.studentId,
          admissionNumber: r.admissionNumber,
          fullName: r.fullName,
          programmeCode: r.programmeCode,
          cohortName: r.cohortName,
          items: [r],
        });
      } else {
        existing.items.push(r);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        b.items.length - a.items.length ||
        compareAdmissionNumbers(a.admissionNumber, b.admissionNumber),
    );
  }, [filteredRecords]);

  const summary = useMemo(() => {
    const studentIds = new Set<string>();
    let catAbsent = 0;
    let examAbsent = 0;
    let missingMarks = 0;

    for (const r of filteredRecords) {
      studentIds.add(r.studentId);
      if (r.catStatus === 'absent') catAbsent += 1;
      if (r.examSubmitted && r.examStatus === 'absent') examAbsent += 1;
      if (r.catStatus === 'missing' && (includeUnstarted || r.catMarkingStarted)) missingMarks += 1;
      if (r.examSubmitted && r.examStatus === 'missing') missingMarks += 1;
    }

    return {
      affectedStudents: studentIds.size,
      catAbsent,
      examAbsent,
      missingMarks,
    };
  }, [filteredRecords, includeUnstarted]);

  async function handleExportExcel() {
    if (filteredRecords.length === 0) return;
    setExporting(true);
    try {
      const payload = {
        periodName: selectedPeriodName,
        rows: filteredRecords.map((r) => {
          const notesParts: string[] = [];
          if (r.catAbsenceReason) notesParts.push(`CAT: ${r.catAbsenceReason}`);
          if (r.examAbsenceReason) notesParts.push(`Exam: ${r.examAbsenceReason}`);
          return {
            admissionNumber: r.admissionNumber,
            fullName: r.fullName,
            programmeCode: r.programmeCode,
            cohortName: r.cohortName,
            unitCode: r.unitCode,
            unitName: r.unitName,
            catDisplay: formatComponentDisplay(r.catStatus, r.catMark, true),
            examDisplay: formatComponentDisplay(r.examStatus, r.examMark, r.examSubmitted),
            notes: notesParts.join(' · '),
          };
        }),
      };

      const res = await fetch('/api/assessment/missing-marks/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safePeriod = selectedPeriodName.replace(/[^a-zA-Z0-9_-]+/g, '_');
      a.download = `missing-marks-absences-${safePeriod}.xlsx`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 print:hidden">
        <MetricCard
          label="Affected Students"
          value={String(summary.affectedStudents)}
          icon={Users}
        />
        <MetricCard
          label="CAT Absent (AB)"
          value={String(summary.catAbsent)}
          icon={UserX}
        />
        <MetricCard
          label="Exam Absent (AB)"
          value={String(summary.examAbsent)}
          icon={AlertTriangle}
        />
        <MetricCard
          label="Missing Marks"
          value={String(summary.missingMarks)}
          icon={FileWarning}
        />
      </section>

      {/* Toolbar */}
      <Card className="p-3.5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View mode toggle + Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('student')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'student'
                    ? 'bg-surface text-text-primary shadow-2xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                By Student ({groupedByStudent.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unit')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'unit'
                    ? 'bg-surface text-text-primary shadow-2xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                By Unit ({filteredRecords.length})
              </button>
            </div>

            {periods.length > 0 ? (
              <select
                aria-label="Academic period"
                value={selectedPeriodId ?? ''}
                onChange={(e) => router.push(`/assessment/missing-marks?period=${e.target.value}`)}
                className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary">
              <input
                type="checkbox"
                checked={includeUnstarted}
                onChange={(e) => setIncludeUnstarted(e.target.checked)}
                className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span>Include unstarted units</span>
            </label>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              Print
            </button>

            <button
              type="button"
              disabled={exporting || filteredRecords.length === 0}
              onClick={() => void handleExportExcel()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Download className="size-3.5" aria-hidden="true" />
              {exporting ? 'Exporting…' : `Export Excel (${filteredRecords.length})`}
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, admission, unit..."
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by issue type"
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
          >
            <option value="all">All Issues</option>
            <option value="cat_absent">CAT Absent (AB)</option>
            <option value="exam_absent">Exam Absent (AB)</option>
            <option value="cat_missing">CAT Missing</option>
            <option value="exam_missing">Exam Missing</option>
            <option value="both">Both CAT &amp; Exam</option>
          </select>

          <select
            aria-label="Filter by programme"
            value={programmeFilter}
            onChange={(e) => {
              setProgrammeFilter(e.target.value);
              setCohortFilter('all');
              setUnitFilter('all');
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
          >
            <option value="all">All Programmes</option>
            {programmes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by cohort"
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
          >
            <option value="all">All Cohorts</option>
            {cohorts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by unit"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-9 max-w-[240px] rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
          >
            <option value="all">All Units</option>
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code} · {u.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Printable Header */}
      <div className="hidden print:block border-b border-slate-300 pb-2 mb-3">
        <h1 className="text-base font-bold text-slate-900">
          IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
        </h1>
        <p className="text-xs font-semibold text-slate-700">
          MISSING MARKS &amp; ABSENCES REGISTER — {departmentName} ({selectedPeriodName})
        </p>
        <p className="text-[11px] text-slate-500">
          Affected Students: {summary.affectedStudents} · Records: {filteredRecords.length}
        </p>
      </div>

      {/* Main Content */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'student' ? (
            <table className="w-full border-collapse text-left text-xs [&_td]:whitespace-nowrap [&_td]:[overflow-wrap:normal] [&_th]:whitespace-nowrap [&_th]:[overflow-wrap:normal]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">No.</th>
                  <th className="px-3 py-3">Admission No.</th>
                  <th className="px-3 py-3">Student Full Name</th>
                  <th className="px-3 py-3">Cohort</th>
                  <th className="px-3 py-3 text-center">Units</th>
                  <th className="px-3 py-3">Flagged Units (CAT / Exam)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedByStudent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">
                      No missing marks or absences match the current filters.
                    </td>
                  </tr>
                ) : (
                  groupedByStudent.map((student, idx) => (
                    <tr key={student.studentId} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-center font-medium text-slate-400">
                        {idx + 1}.
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {student.admissionNumber}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        <Link
                          href={`/students/registry/${student.studentId}/results`}
                          className="whitespace-nowrap hover:text-primary hover:underline"
                        >
                          {student.fullName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {student.cohortName}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="neutral">{student.items.length}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-nowrap items-center gap-1.5">
                          {student.items.map((item) => {
                            const catLabel = formatComponentDisplay(
                              item.catStatus,
                              item.catMark,
                              true,
                            );
                            const examLabel = formatComponentDisplay(
                              item.examStatus,
                              item.examMark,
                              item.examSubmitted,
                            );
                            const hasAbsent =
                              item.catStatus === 'absent' ||
                              (item.examSubmitted && item.examStatus === 'absent');
                            return (
                              <Link
                                key={item.key}
                                href={`/assessment/marks/${item.assessmentId}`}
                                title={`${item.unitCode} — ${item.unitName} (Open Markbook)`}
                                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium transition hover:shadow-2xs ${
                                  hasAbsent
                                    ? 'border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100/80'
                                    : 'border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80'
                                }`}
                              >
                                <span className="font-mono font-bold whitespace-nowrap">{item.unitCode}</span>
                                <span className="text-[10px] opacity-80 whitespace-nowrap">
                                  CAT: {catLabel}
                                  {item.examSubmitted ? ` · Exam: ${examLabel}` : ''}
                                </span>
                                <ExternalLink className="size-2.5 shrink-0 opacity-60 print:hidden" aria-hidden="true" />
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left text-xs [&_td]:whitespace-nowrap [&_td]:[overflow-wrap:normal] [&_th]:whitespace-nowrap [&_th]:[overflow-wrap:normal]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">No.</th>
                  <th className="px-3 py-3">Admission No.</th>
                  <th className="px-3 py-3">Student Full Name</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3 text-center">CAT</th>
                  <th className="px-3 py-3 text-center">Exam</th>
                  <th className="px-3 py-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-500">
                      No missing marks or absences match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={r.key} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-center font-medium text-slate-400">
                        {idx + 1}.
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {r.admissionNumber}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        <Link
                          href={`/students/registry/${r.studentId}/results`}
                          className="whitespace-nowrap hover:text-primary hover:underline"
                        >
                          {r.fullName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">{r.unitCode}</span>
                        <span className="ml-1.5 text-slate-600 whitespace-nowrap">{r.unitName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusPill
                          status={r.catStatus}
                          mark={r.catMark}
                          active={true}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusPill
                          status={r.examStatus}
                          mark={r.examMark}
                          active={r.examSubmitted}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right print:hidden">
                        <Link
                          href={`/assessment/marks/${r.assessmentId}`}
                          className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-primary"
                        >
                          Markbook
                          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
