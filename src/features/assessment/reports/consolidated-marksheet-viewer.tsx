'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Printer,
  Search,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AssessmentPeriodReportData, ReportStudentRow } from './queries';

interface ConsolidatedMarksheetViewerProps {
  data: AssessmentPeriodReportData;
  initialView?: 'cohort' | 'unit';
  initialCohortId?: string;
  initialUnitId?: string;
}

function formatMark(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(Math.round(value));
}

function getGradeBadgeClass(grade: string | null | undefined): string {
  if (!grade) return 'bg-slate-50 text-slate-400 border border-slate-200';
  const upper = grade.toUpperCase();
  if (upper.includes('DISTINCTION')) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold';
  }
  if (upper.includes('CREDIT')) {
    return 'bg-teal-50 text-teal-800 border border-teal-200 font-bold';
  }
  if (upper.includes('PASS')) {
    return 'bg-slate-100 text-slate-800 border border-slate-300 font-bold';
  }
  if (upper.includes('REFER') || upper.includes('FAIL')) {
    return 'bg-amber-50 text-amber-800 border border-amber-200 font-bold';
  }
  if (upper.includes('ABSENT')) {
    return 'bg-rose-50 text-rose-800 border border-rose-200 font-bold';
  }
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ConsolidatedMarksheetViewer({
  data,
  initialView = 'cohort',
  initialCohortId,
  initialUnitId,
}: ConsolidatedMarksheetViewerProps) {
  const searchInputId = useId();
  const cohortSelectId = useId();
  const unitSelectId = useId();
  const periodSelectId = useId();

  const [viewMode, setViewMode] = useState<'cohort' | 'unit'>(initialView);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all cohorts represented in this dataset
  const cohorts = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    const studentsByCohort = new Map<string, Set<string>>();
    const unitsByCohort = new Map<string, Set<string>>();

    for (const row of data.rows) {
      if (!studentsByCohort.has(row.cohortId)) studentsByCohort.set(row.cohortId, new Set());
      studentsByCohort.get(row.cohortId)!.add(row.studentId);

      if (!unitsByCohort.has(row.cohortId)) unitsByCohort.set(row.cohortId, new Set());
      unitsByCohort.get(row.cohortId)!.add(row.unitId);

      if (!map.has(row.cohortId)) {
        map.set(row.cohortId, { id: row.cohortId, name: row.cohortName });
      }
    }

    return Array.from(map.values())
      .map((c) => ({
        ...c,
        studentCount: studentsByCohort.get(c.id)?.size ?? 0,
        unitCount: unitsByCohort.get(c.id)?.size ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.rows]);

  // Extract all units represented in this dataset
  const units = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string; eventId: string }>();
    const studentsByUnit = new Map<string, Set<string>>();
    const cohortsByUnit = new Map<string, Set<string>>();

    for (const row of data.rows) {
      if (!studentsByUnit.has(row.unitId)) studentsByUnit.set(row.unitId, new Set());
      studentsByUnit.get(row.unitId)!.add(row.studentId);

      if (!cohortsByUnit.has(row.unitId)) cohortsByUnit.set(row.unitId, new Set());
      cohortsByUnit.get(row.unitId)!.add(row.cohortId);

      if (!map.has(row.unitId)) {
        map.set(row.unitId, {
          id: row.unitId,
          code: row.unitCode,
          name: row.unitName,
          eventId: row.eventId,
        });
      }
    }

    return Array.from(map.values())
      .map((u) => ({
        ...u,
        studentCount: studentsByUnit.get(u.id)?.size ?? 0,
        cohortCount: cohortsByUnit.get(u.id)?.size ?? 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data.rows]);

  const [selectedCohortId, setSelectedCohortId] = useState<string>(() => {
    if (initialCohortId && cohorts.some((c) => c.id === initialCohortId)) {
      return initialCohortId;
    }
    return cohorts[0]?.id ?? '';
  });

  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
    if (initialUnitId && units.some((u) => u.id === initialUnitId)) {
      return initialUnitId;
    }
    return units[0]?.id ?? '';
  });

  const [broadsheetFilter, setBroadsheetFilter] = useState<'all' | 'pass' | 'refer' | 'incomplete'>('all');
  const [unitCohortFilter, setUnitCohortFilter] = useState<string>('all');

  // ==========================================
  // COHORT BROADSHEET MATRIX DATA PREPARATION
  // ==========================================
  const activeCohort = useMemo(() => {
    return cohorts.find((c) => c.id === selectedCohortId) ?? cohorts[0] ?? null;
  }, [cohorts, selectedCohortId]);

  const cohortData = useMemo(() => {
    if (!activeCohort) return { units: [], students: [], stats: null };

    const rows = data.rows.filter((r) => r.cohortId === activeCohort.id);

    // Discover distinct units taken by this cohort
    const unitMap = new Map<string, { id: string; code: string; name: string; eventId: string }>();
    for (const r of rows) {
      if (!unitMap.has(r.unitId)) {
        unitMap.set(r.unitId, {
          id: r.unitId,
          code: r.unitCode,
          name: r.unitName,
          eventId: r.eventId,
        });
      }
    }
    const cohortUnits = Array.from(unitMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    // Group rows by student
    const studentMap = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        fullName: string;
        unitMarks: Record<string, { total: number | null; grade: string | null; isAbsent: boolean }>;
      }
    >();

    for (const r of rows) {
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          admissionNumber: r.admissionNumber,
          fullName: r.fullName,
          unitMarks: {},
        });
      }
      studentMap.get(r.studentId)!.unitMarks[r.unitId] = {
        total: r.total,
        grade: r.grade,
        isAbsent: r.attendance === 'absent',
      };
    }

    const students = Array.from(studentMap.values()).map((s) => {
      let sumTotal = 0;
      let scoredCount = 0;
      let passedCount = 0;
      let allAbsent = true;

      for (const u of cohortUnits) {
        const mark = s.unitMarks[u.id];
        if (mark) {
          if (!mark.isAbsent) allAbsent = false;
          if (mark.total !== null && mark.total !== undefined) {
            sumTotal += mark.total;
            scoredCount += 1;
            if (mark.total >= 40) passedCount += 1;
          }
        }
      }

      const average = scoredCount > 0 ? Math.round(sumTotal / scoredCount) : null;
      const isComplete = scoredCount === cohortUnits.length;
      let status: 'PASS' | 'REFER' | 'INCOMPLETE' | 'ABSENT' = 'INCOMPLETE';

      if (allAbsent && cohortUnits.length > 0) {
        status = 'ABSENT';
      } else if (isComplete && passedCount === cohortUnits.length) {
        status = 'PASS';
      } else if (scoredCount > 0 && passedCount < scoredCount) {
        status = 'REFER';
      } else if (isComplete) {
        status = 'PASS';
      } else {
        status = 'INCOMPLETE';
      }

      return {
        ...s,
        totalScore: scoredCount > 0 ? sumTotal : null,
        average,
        scoredCount,
        passedCount,
        registeredCount: cohortUnits.length,
        status,
      };
    }).sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }));

    // Cohort-wide Statistics
    let passedAllCount = 0;
    let referCount = 0;
    let incompleteCount = 0;
    let absentCount = 0;
    let sumCohortAvg = 0;
    let scoredAvgCount = 0;

    for (const s of students) {
      if (s.status === 'PASS') passedAllCount += 1;
      else if (s.status === 'REFER') referCount += 1;
      else if (s.status === 'ABSENT') absentCount += 1;
      else incompleteCount += 1;

      if (s.average !== null) {
        sumCohortAvg += s.average;
        scoredAvgCount += 1;
      }
    }

    // Unit-by-unit statistics for footer
    const unitStats = cohortUnits.map((u) => {
      let sum = 0;
      let count = 0;
      let pass = 0;

      for (const s of students) {
        const mark = s.unitMarks[u.id];
        if (mark && mark.total !== null && !mark.isAbsent) {
          sum += mark.total;
          count += 1;
          if (mark.total >= 40) pass += 1;
        }
      }

      return {
        unitId: u.id,
        mean: count > 0 ? Math.round(sum / count) : null,
        passRate: count > 0 ? Math.round((pass / count) * 100) : null,
        satCount: count,
      };
    });

    const cohortMean = scoredAvgCount > 0 ? Math.round(sumCohortAvg / scoredAvgCount) : null;
    const overallPassRate = students.length > 0 ? Math.round((passedAllCount / students.length) * 100) : null;

    return {
      units: cohortUnits,
      students,
      stats: {
        totalStudents: students.length,
        unitsCount: cohortUnits.length,
        cohortMean,
        overallPassRate,
        passedAllCount,
        referCount,
        incompleteCount,
        absentCount,
        unitStats,
      },
    };
  }, [activeCohort, data.rows]);

  // Filtered students in Cohort Broadsheet
  const filteredCohortStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cohortData.students.filter((s) => {
      if (q) {
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchAdm = s.admissionNumber.toLowerCase().includes(q);
        if (!matchName && !matchAdm) return false;
      }

      if (broadsheetFilter === 'pass' && s.status !== 'PASS') return false;
      if (broadsheetFilter === 'refer' && s.status !== 'REFER') return false;
      if (broadsheetFilter === 'incomplete' && s.status !== 'INCOMPLETE') return false;

      return true;
    });
  }, [cohortData.students, searchQuery, broadsheetFilter]);

  // ==========================================
  // PER UNIT CONSOLIDATED MARKSHEET DATA
  // ==========================================
  const activeUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) ?? units[0] ?? null;
  }, [units, selectedUnitId]);

  const unitData = useMemo(() => {
    if (!activeUnit) return { rows: [], cohorts: [], stats: null };

    const allUnitRows = data.rows.filter((r) => r.unitId === activeUnit.id);

    // Cohorts taking this unit
    const cohortMap = new Map<string, string>();
    for (const r of allUnitRows) {
      cohortMap.set(r.cohortId, r.cohortName);
    }
    const unitCohorts = Array.from(cohortMap.entries()).map(([id, name]) => ({ id, name }));

    let sumAssign = 0;
    let countAssign = 0;
    let sumPres = 0;
    let countPres = 0;
    let sumRat = 0;
    let countRat = 0;
    let sumCat = 0;
    let countCat = 0;
    let sumExam = 0;
    let countExam = 0;
    let sumTotal = 0;
    let countTotal = 0;

    let distinction = 0;
    let credit = 0;
    let pass = 0;
    let refer = 0;
    let absent = 0;

    for (const r of allUnitRows) {
      if (r.attendance === 'absent') {
        absent += 1;
        continue;
      }

      if (r.assignment !== null) {
        sumAssign += r.assignment;
        countAssign += 1;
      }
      if (r.presentation !== null) {
        sumPres += r.presentation;
        countPres += 1;
      }
      if (r.rat !== null) {
        sumRat += r.rat;
        countRat += 1;
      }
      if (r.cat1 !== null) {
        sumCat += r.cat1;
        countCat += 1;
      }
      if (r.exam !== null) {
        sumExam += r.exam;
        countExam += 1;
      }
      if (r.total !== null) {
        sumTotal += r.total;
        countTotal += 1;

        if (r.total >= 75) distinction += 1;
        else if (r.total >= 65) credit += 1;
        else if (r.total >= 40) pass += 1;
        else refer += 1;
      }
    }

    const meanTotal = countTotal > 0 ? Math.round(sumTotal / countTotal) : null;
    const passedCount = distinction + credit + pass;
    const passRate = countTotal > 0 ? Math.round((passedCount / countTotal) * 100) : null;

    return {
      rows: allUnitRows.sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true })),
      cohorts: unitCohorts,
      stats: {
        totalEnrolled: allUnitRows.length,
        satCount: allUnitRows.length - absent,
        absentCount: absent,
        markedCount: countTotal,
        meanAssignment: countAssign > 0 ? Math.round(sumAssign / countAssign) : null,
        meanPresentation: countPres > 0 ? Math.round(sumPres / countPres) : null,
        meanRat: countRat > 0 ? Math.round(sumRat / countRat) : null,
        meanCat: countCat > 0 ? Math.round(sumCat / countCat) : null,
        meanExam: countExam > 0 ? Math.round(sumExam / countExam) : null,
        meanTotal,
        passRate,
        distinction,
        credit,
        pass,
        refer,
      },
    };
  }, [activeUnit, data.rows]);

  // Filtered rows in Unit Consolidated Marksheet
  const filteredUnitRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unitData.rows.filter((r) => {
      if (q) {
        const matchName = r.fullName.toLowerCase().includes(q);
        const matchAdm = r.admissionNumber.toLowerCase().includes(q);
        if (!matchName && !matchAdm) return false;
      }

      if (unitCohortFilter !== 'all' && r.cohortId !== unitCohortFilter) {
        return false;
      }

      return true;
    });
  }, [unitData.rows, searchQuery, unitCohortFilter]);

  // ==========================================
  // CSV EXPORT GENERATION
  // ==========================================
  function handleExportCohortCsv() {
    if (!activeCohort || !cohortData.students.length) return;

    const headers = [
      'S/No',
      'Admission No',
      'Student Full Name',
      ...cohortData.units.map((u) => `"${u.code} (${u.name.replace(/"/g, '""')})"`),
      'Average Mark',
      'Total Score',
      'Passed / Registered',
      'Overall Status',
    ];

    const lines = filteredCohortStudents.map((s, idx) => {
      const unitValues = cohortData.units.map((u) => {
        const mark = s.unitMarks[u.id];
        if (!mark) return '—';
        if (mark.isAbsent) return 'AB';
        if (mark.total !== null) return `${formatMark(mark.total)}${mark.grade ? ` (${mark.grade})` : ''}`;
        return 'Pending';
      });

      return [
        idx + 1,
        `"${s.admissionNumber}"`,
        `"${s.fullName.replace(/"/g, '""')}"`,
        ...unitValues,
        formatMark(s.average),
        formatMark(s.totalScore),
        `"${s.passedCount} / ${s.registeredCount}"`,
        s.status,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...lines].join('\n');
    const safeName = activeCohort.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCsv(`Broadsheet_${safeName}_${data.periodName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`, csvContent);
  }

  function handleExportUnitCsv() {
    if (!activeUnit || !unitData.rows.length) return;

    const headers = [
      'S/No',
      'Admission No',
      'Student Full Name',
      'Assignment (/5)',
      'Presentation (/10)',
      'RAT (/15)',
      'CAT (/15)',
      'Exam (/70)',
      'Total (/100)',
      'Grade',
    ];

    const lines = filteredUnitRows.map((r, idx) => {
      return [
        idx + 1,
        `"${r.admissionNumber}"`,
        `"${r.fullName.replace(/"/g, '""')}"`,
        formatMark(r.assignment),
        formatMark(r.presentation),
        formatMark(r.rat),
        formatMark(r.cat1),
        r.attendance === 'absent' ? 'AB' : formatMark(r.exam),
        r.attendance === 'absent' ? 'AB' : formatMark(r.total),
        r.attendance === 'absent' ? 'ABSENT' : r.grade ?? '—',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...lines].join('\n');
    const safeUnit = activeUnit.code.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCsv(`Consolidated_Marksheet_${safeUnit}_${data.periodName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`, csvContent);
  }

  return (
    <div className="space-y-5">
      {/* Top Navigation & View Switcher */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Mode Switcher Buttons */}
          <div
            role="tablist"
            aria-label="Marksheet view mode"
            className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-100 p-1 shadow-2xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cohort'}
              onClick={() => {
                setViewMode('cohort');
                setSearchQuery('');
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'cohort'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
              }`}
            >
              <GraduationCap className={`size-4 ${viewMode === 'cohort' ? 'text-sky-300' : 'text-slate-500'}`} />
              <span>Per Cohort Broadsheet Matrix</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'unit'}
              onClick={() => {
                setViewMode('unit');
                setSearchQuery('');
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'unit'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
              }`}
            >
              <BookOpen className={`size-4 ${viewMode === 'unit' ? 'text-sky-300' : 'text-slate-500'}`} />
              <span>Per Unit Consolidated Marksheet</span>
            </button>
          </div>

          {/* Academic Period Indicator / Switcher */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Academic Period:</span>
            {data.periods && data.periods.length > 1 ? (
              <div className="relative">
                <label htmlFor={periodSelectId} className="sr-only">
                  Academic Period
                </label>
                <select
                  id={periodSelectId}
                  value={data.periodId}
                  onChange={(e) => {
                    const newPeriodId = e.target.value;
                    window.location.href = `/assessment/reports?periodId=${newPeriodId}&view=${viewMode}`;
                  }}
                  className="h-8 appearance-none rounded-lg border border-slate-300 bg-white pl-2.5 pr-7 text-xs font-bold text-slate-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {data.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status === 'active' ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
              </div>
            ) : (
              <Badge variant="neutral" className="bg-slate-100 font-bold text-slate-800">
                {data.periodName}
              </Badge>
            )}
          </div>
        </div>

        {/* Primary Filter Bar for Selected View */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Cohort Selector (in Cohort View) */}
            {viewMode === 'cohort' ? (
              <div className="relative min-w-[260px]">
                <label htmlFor={cohortSelectId} className="sr-only">
                  Select Cohort
                </label>
                <select
                  id={cohortSelectId}
                  value={selectedCohortId}
                  onChange={(e) => {
                    setSelectedCohortId(e.target.value);
                    setSearchQuery('');
                  }}
                  className="h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-bold text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students · {c.unitCount} units)
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            ) : (
              /* Unit Selector (in Unit View) */
              <div className="relative min-w-[280px]">
                <label htmlFor={unitSelectId} className="sr-only">
                  Select Unit
                </label>
                <select
                  id={unitSelectId}
                  value={selectedUnitId}
                  onChange={(e) => {
                    setSelectedUnitId(e.target.value);
                    setSearchQuery('');
                  }}
                  className="h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-bold text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} · {u.name} ({u.studentCount} candidates)
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            )}

            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate name or admission..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {/* Sub-filters */}
            {viewMode === 'cohort' ? (
              <div className="relative">
                <select
                  value={broadsheetFilter}
                  onChange={(e) => setBroadsheetFilter(e.target.value as typeof broadsheetFilter)}
                  className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Recommendations</option>
                  <option value="pass">Pass Only</option>
                  <option value="refer">Refer / Failed Only</option>
                  <option value="incomplete">Incomplete Only</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
              </div>
            ) : unitData.cohorts.length > 1 ? (
              <div className="relative">
                <select
                  value={unitCohortFilter}
                  onChange={(e) => setUnitCohortFilter(e.target.value)}
                  className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Cohorts ({unitData.cohorts.length})</option>
                  {unitData.cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
              </div>
            ) : null}
          </div>

          {/* Action buttons (Print & Export) */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {viewMode === 'unit' && activeUnit ? (
              <Link
                href={`/assessment/marks/${activeUnit.eventId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                title="Open unit markbook editor"
              >
                <span>Open Markbook</span>
                <ArrowUpRight className="size-3.5 text-slate-500" />
              </Link>
            ) : null}

            <button
              type="button"
              onClick={viewMode === 'cohort' ? handleExportCohortCsv : handleExportUnitCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Download CSV"
            >
              <Download className="size-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Print consolidated report"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW MODE 1: PER COHORT BROADSHEET MATRIX                */}
      {/* ========================================================= */}
      {viewMode === 'cohort' ? (
        activeCohort ? (
          <div className="space-y-4">
            {/* Performance Telemetry Cards */}
            {cohortData.stats ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cohort Roster</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">
                    {cohortData.stats.totalStudents} Candidates
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Across {cohortData.stats.unitsCount} examinable units
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cohort Mean Score</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">
                    {cohortData.stats.cohortMean !== null ? `${cohortData.stats.cohortMean} / 100` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">Average across all registered units</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overall Pass Rate</p>
                  <p className="mt-1 text-base font-extrabold text-emerald-800">
                    {cohortData.stats.overallPassRate !== null ? `${cohortData.stats.overallPassRate}%` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {cohortData.stats.passedAllCount} passed all units
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status Breakdown</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200">
                      Pass: {cohortData.stats.passedAllCount}
                    </span>
                    {cohortData.stats.referCount > 0 ? (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200">
                        Refer: {cohortData.stats.referCount}
                      </span>
                    ) : null}
                    {cohortData.stats.incompleteCount > 0 ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                        Pending: {cohortData.stats.incompleteCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Printable Heading (hidden on screen, visible on print) */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
              <h1 className="text-base font-black text-slate-900 uppercase">
                IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
              </h1>
              <p className="text-xs font-bold text-slate-800">
                COHORT EXAMINATION BROADSHEET MATRIX · {activeCohort.name}
              </p>
              <p className="text-[11px] text-slate-600">
                Academic Period: {data.periodName} · Department: {data.departmentName} · Candidates: {cohortData.students.length}
              </p>
            </div>

            {/* Master Cohort Broadsheet Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
                  <tr>
                    <th className="w-10 px-3.5 py-2.5 text-center text-slate-500 whitespace-nowrap">No.</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap min-w-[170px] text-slate-800">Admission No.</th>
                    <th className="px-3.5 py-2.5 min-w-[260px] whitespace-nowrap border-r-2 border-slate-300 text-slate-900">Student Full Name</th>

                    {/* Dynamic Unit Headers */}
                    {cohortData.units.map((unit) => (
                      <th
                        key={unit.id}
                        className="px-2.5 py-2.5 text-center min-w-[95px] whitespace-nowrap border-r border-slate-200/80 bg-slate-50/80"
                        title={`${unit.code} - ${unit.name}`}
                      >
                        <div className="font-extrabold text-slate-900">{unit.code}</div>
                        <div className="text-[9px] font-medium text-slate-500 max-w-[110px] truncate mx-auto">
                          {unit.name}
                        </div>
                      </th>
                    ))}

                    {/* Summary Columns — Golden Yellow Highlight on Student Average */}
                    <th className="px-3 py-2.5 text-center whitespace-nowrap border-l-2 border-amber-300 bg-amber-100/90 font-black text-amber-950 shadow-2xs">
                      Average
                    </th>
                    <th className="px-2.5 py-2.5 text-center whitespace-nowrap bg-amber-50/60 font-bold text-amber-900 border-r border-amber-200/80">
                      Total
                    </th>
                    <th className="px-2.5 py-2.5 text-center whitespace-nowrap text-slate-700 border-r border-slate-200">
                      Passed / Reg
                    </th>
                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                      Recommendation
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredCohortStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={cohortData.units.length + 7}
                        className="px-4 py-12 text-center text-xs text-slate-500"
                      >
                        <p className="font-semibold text-slate-700">No students match your filter criteria.</p>
                        <p className="mt-1 text-[11px] text-slate-400">Try adjusting your search query above.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCohortStudents.map((student, idx) => (
                      <tr
                        key={student.studentId}
                        className="transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35"
                      >
                        <td className="px-3.5 py-2.5 text-center font-medium text-slate-400 whitespace-nowrap">
                          {idx + 1}.
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-950 whitespace-nowrap min-w-[170px]">
                          {student.admissionNumber}
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap min-w-[260px] border-r-2 border-slate-200">
                          {student.fullName}
                        </td>

                        {/* Marks for each unit */}
                        {cohortData.units.map((unit) => {
                          const mark = student.unitMarks[unit.id];
                          if (!mark) {
                            return (
                              <td key={unit.id} className="px-2.5 py-2.5 text-center border-r border-slate-100 text-slate-300">
                                —
                              </td>
                            );
                          }
                          if (mark.isAbsent) {
                            return (
                              <td key={unit.id} className="px-2.5 py-2.5 text-center border-r border-slate-100">
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                                  AB
                                </span>
                              </td>
                            );
                          }
                          if (mark.total === null || mark.total === undefined) {
                            return (
                              <td key={unit.id} className="px-2.5 py-2.5 text-center border-r border-slate-100 text-[10px] text-slate-400 italic">
                                Pending
                              </td>
                            );
                          }

                          const score = mark.total;
                          const isPass = score >= 40;

                          return (
                            <td key={unit.id} className="px-2.5 py-2.5 text-center border-r border-slate-100 font-mono tabular-nums">
                              <div className={`font-bold ${isPass ? (score >= 75 ? 'text-emerald-800' : 'text-slate-900') : 'text-amber-800'}`}>
                                {formatMark(score)}
                              </div>
                              {mark.grade ? (
                                <div className="text-[9px] font-semibold text-slate-500 uppercase font-sans">
                                  {mark.grade}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}

                        {/* Summary Columns — Golden Yellow Highlight */}
                        <td className="px-3 py-2.5 text-center border-l-2 border-amber-300 bg-amber-50/80 font-black text-amber-950 font-mono tabular-nums shadow-2xs">
                          {formatMark(student.average)}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-bold text-amber-900 bg-amber-50/40 border-r border-amber-200/80 font-mono tabular-nums">
                          {formatMark(student.totalScore)}
                        </td>
                        <td className="px-2.5 py-2.5 text-center text-slate-700 font-medium border-r border-slate-200">
                          {student.passedCount} / {student.registeredCount}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {student.status === 'PASS' ? (
                            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              PASS
                            </span>
                          ) : student.status === 'REFER' ? (
                            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              REFER
                            </span>
                          ) : student.status === 'ABSENT' ? (
                            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              ABSENT
                            </span>
                          ) : (
                            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              INCOMPLETE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Broadsheet Class Summary Footer */}
                {cohortData.stats && cohortData.stats.unitStats.length > 0 ? (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
                    {/* Row 1: Mean Scores */}
                    <tr>
                      <td colSpan={3} className="px-3.5 py-2.5 text-right uppercase tracking-wider text-[11px] text-slate-600 font-extrabold whitespace-nowrap border-r-2 border-slate-300">
                        Unit Mean Score:
                      </td>
                      {cohortData.stats.unitStats.map((us) => (
                        <td key={us.unitId} className="px-2.5 py-2.5 text-center border-l border-slate-200 text-slate-900 font-black">
                          {formatMark(us.mean)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center border-l-2 border-slate-300 bg-slate-100 font-black text-slate-900">
                        {formatMark(cohortData.stats.cohortMean)}
                      </td>
                      <td colSpan={3} className="px-3 py-2.5 text-center text-[10px] text-slate-500 font-medium whitespace-nowrap">
                        Cohort Average
                      </td>
                    </tr>

                    {/* Row 2: Pass Rates */}
                    <tr className="border-t border-slate-200/60">
                      <td colSpan={3} className="px-3.5 py-2 text-right uppercase tracking-wider text-[10px] text-slate-500 font-bold whitespace-nowrap border-r-2 border-slate-300">
                        Unit Pass Rate:
                      </td>
                      {cohortData.stats.unitStats.map((us) => (
                        <td key={us.unitId} className="px-2.5 py-2 text-center border-l border-slate-200 text-[10px] text-emerald-800 font-bold">
                          {us.passRate !== null ? `${us.passRate}%` : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center border-l-2 border-slate-300 bg-slate-100 text-[10px] text-emerald-900 font-bold">
                        {cohortData.stats.overallPassRate !== null ? `${cohortData.stats.overallPassRate}%` : '—'}
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-center text-[10px] text-slate-500 font-medium">
                        Overall Pass Rate
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            No cohorts available in the selected academic period.
          </div>
        )
      ) : (
        /* ========================================================= */
        /* VIEW MODE 2: PER UNIT CONSOLIDATED MARKSHEET              */
        /* ========================================================= */
        activeUnit ? (
          <div className="space-y-4">
            {/* Unit Performance Telemetry */}
            {unitData.stats ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Enrolled</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">
                    {unitData.stats.totalEnrolled} Candidates
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Across {unitData.cohorts.length} cohort{unitData.cohorts.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Mean Score</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">
                    {unitData.stats.meanTotal !== null ? `${unitData.stats.meanTotal} / 100` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">{unitData.stats.markedCount} candidate results scored</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pass Rate</p>
                  <p className="mt-1 text-base font-extrabold text-emerald-800">
                    {unitData.stats.passRate !== null ? `${unitData.stats.passRate}%` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {unitData.stats.distinction + unitData.stats.credit + unitData.stats.pass} passed
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grade Distribution</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200">
                      Dist: {unitData.stats.distinction}
                    </span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-800 border border-teal-200">
                      Cred: {unitData.stats.credit}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-300">
                      Pass: {unitData.stats.pass}
                    </span>
                    {unitData.stats.refer > 0 ? (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200">
                        Refer: {unitData.stats.refer}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Printable Heading (hidden on screen, visible on print) */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
              <h1 className="text-base font-black text-slate-900 uppercase">
                IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
              </h1>
              <p className="text-xs font-bold text-slate-800">
                CONSOLIDATED UNIT MARKSHEET · {activeUnit.code} {activeUnit.name}
              </p>
              <p className="text-[11px] text-slate-600">
                Academic Period: {data.periodName} · Department: {data.departmentName} · Candidates: {unitData.rows.length}
              </p>
            </div>

            {/* Sharing Cohorts Tab Bar for Shared Units */}
            {unitData.cohorts.length > 1 ? (
              <div
                role="tablist"
                aria-label="Filter unit candidates by sharing cohort"
                className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100/80 p-1.5 shadow-2xs print:hidden"
              >
                <span className="flex items-center gap-1.5 px-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <GraduationCap className="size-3.5 text-slate-400" />
                  Sharing Cohorts:
                </span>
                <button
                  type="button"
                  role="tab"
                  aria-selected={unitCohortFilter === 'all'}
                  onClick={() => setUnitCohortFilter('all')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                    unitCohortFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>All Cohorts</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                      unitCohortFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {unitData.rows.length}
                  </span>
                </button>
                {unitData.cohorts.map((c) => {
                  const count = unitData.rows.filter((r) => r.cohortId === c.id).length;
                  const isSelected = unitCohortFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setUnitCohortFilter(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                          isSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Consolidated Unit Marksheet Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
                  {/* Tier 1 Category Super-Header */}
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th
                      colSpan={3}
                      scope="colgroup"
                      className="px-3.5 py-1.5 text-left bg-slate-100/90 border-r-2 border-slate-300 text-slate-800 whitespace-nowrap"
                    >
                      Candidate Details
                    </th>
                    <th
                      colSpan={4}
                      scope="colgroup"
                      className="px-2.5 py-1.5 text-center bg-slate-50 border-r border-slate-200 text-slate-700"
                    >
                      Continuous Assessment (Coursework · 30%)
                    </th>
                    <th
                      colSpan={1}
                      scope="colgroup"
                      className="px-2.5 py-1.5 text-center bg-slate-100/80 border-r border-slate-200 text-slate-800"
                    >
                      Final Exam (70%)
                    </th>
                    <th
                      colSpan={2}
                      scope="colgroup"
                      className="px-3 py-1.5 text-center bg-amber-100/90 border-l border-amber-300 text-amber-950 font-black shadow-2xs"
                    >
                      Final Aggregate
                    </th>
                  </tr>

                  {/* Tier 2 Detail Header */}
                  <tr className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
                    <th scope="col" className="w-12 px-3.5 py-2.5 text-center text-slate-500 whitespace-nowrap">No.</th>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap min-w-[170px] text-slate-800">Admission No.</th>
                    <th scope="col" className="px-3.5 py-2.5 min-w-[260px] whitespace-nowrap border-r-2 border-slate-300 text-slate-900">Student Full Name</th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap">
                      Assignment <span className="text-[10px] font-normal text-slate-400">/5</span>
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap">
                      Presentation <span className="text-[10px] font-normal text-slate-400">/10</span>
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap">
                      RAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap border-r border-slate-200">
                      CAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap border-r border-slate-200">
                      Exam <span className="text-[10px] font-normal text-slate-400">/70</span>
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300 shadow-2xs">
                      Total <span className="text-[10px] font-bold text-amber-800">/100</span>
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/50">Grade</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredUnitRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">No candidates match your filter criteria.</p>
                        <p className="mt-1 text-[11px] text-slate-400">Try adjusting your search query above.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUnitRows.map((r, idx) => {
                      const isAbsent = r.attendance === 'absent';
                      return (
                        <tr
                          key={`${r.eventId}:${r.studentId}`}
                          className={`transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35 ${isAbsent ? 'bg-rose-50/30' : ''}`}
                        >
                          <td className="px-3.5 py-2.5 text-center font-medium text-slate-400 whitespace-nowrap">
                            {idx + 1}.
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-950 whitespace-nowrap min-w-[170px]">
                            {r.admissionNumber}
                          </td>
                          <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap min-w-[260px] border-r-2 border-slate-200">
                            {r.fullName}
                          </td>

                          {/* Marks columns */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(r.assignment)}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(r.presentation)}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(r.rat)}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums border-r border-slate-200">
                            {formatMark(r.cat1)}
                          </td>
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium tabular-nums border-r border-slate-200">
                            {isAbsent ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                                AB
                              </span>
                            ) : (
                              <span className="text-slate-900 font-bold">{formatMark(r.exam)}</span>
                            )}
                          </td>

                          {/* Total — Golden Yellow Highlight Column */}
                          <td className="px-2.5 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90">
                            {isAbsent ? (
                              <span className="text-[11px] font-bold text-rose-700">AB</span>
                            ) : r.total !== null ? (
                              <span className="text-xs font-black text-amber-950 font-mono tabular-nums">
                                {formatMark(r.total)}
                              </span>
                            ) : (
                              <span className="text-amber-300/80 font-light">—</span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/30">
                            {isAbsent ? (
                              <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                ABSENT
                              </span>
                            ) : r.grade ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] ${getGradeBadgeClass(
                                  r.grade,
                                )}`}
                              >
                                {r.grade}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Footer Class Averages */}
                {unitData.stats && unitData.stats.markedCount > 0 ? (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-800">
                    <tr>
                      <td colSpan={3} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-700 font-extrabold border-r-2 border-slate-300 whitespace-nowrap">
                        Class Average ({unitData.stats.markedCount} scored):
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">{formatMark(unitData.stats.meanAssignment)}</td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">{formatMark(unitData.stats.meanPresentation)}</td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">{formatMark(unitData.stats.meanRat)}</td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums border-r border-slate-200">{formatMark(unitData.stats.meanCat)}</td>
                      <td className="px-2.5 py-3 text-center text-slate-900 font-mono font-black border-r border-slate-200">{formatMark(unitData.stats.meanExam)}</td>
                      <td className="px-2.5 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                        {formatMark(unitData.stats.meanTotal)}
                      </td>
                      <td className="px-3 py-3 text-center text-[10px] text-slate-700 bg-amber-50/40 font-bold">
                        {unitData.stats.passRate !== null ? `${unitData.stats.passRate}% Pass Rate` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            No units available in the selected academic period.
          </div>
        )
      )}
    </div>
  );
}
