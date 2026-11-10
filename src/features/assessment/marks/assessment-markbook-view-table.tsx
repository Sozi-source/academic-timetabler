'use client';

import { useId, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Filter, Printer, Search, Users, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AssessmentCandidateRow } from '@/features/assessment/types';
import type { CandidateMarkRecord } from './types';

interface AssessmentMarkbookViewTableProps {
  population: AssessmentCandidateRow[];
  marksByStudent: Record<string, CandidateMarkRecord>;
  assessmentType: 'cat' | 'exam';
  maxMark: number;
  passMark: number;
  marksSubmitted: boolean;
  isComplete: boolean;
  unitCode: string;
  unitName: string;
  periodName: string;
  initialStatus?: string;
  initialView?: string;
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

export function AssessmentMarkbookViewTable({
  population,
  marksByStudent,
  assessmentType,
  maxMark,
  passMark,
  marksSubmitted,
  isComplete,
  unitCode,
  unitName,
  periodName,
  initialStatus,
  initialView,
}: AssessmentMarkbookViewTableProps) {
  const searchInputId = useId();
  const cohortSelectId = useId();
  const statusSelectId = useId();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus || 'all');
  const [viewMode, setViewMode] = useState<'all' | 'cat'>(initialView === 'cat' ? 'cat' : 'all');

  // Discover distinct cohorts present in this population
  const cohorts = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of population) {
      if (row.cohort?.id) {
        map.set(row.cohort.id, row.cohort.name || row.cohort.code || 'Unnamed Cohort');
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [population]);

  // Merge population with marks
  const rows = useMemo(() => {
    return population.map((row) => {
      const studentId = row.student?.id ?? '';
      const marks = marksByStudent[studentId] ?? null;
      const isAbsent = row.attendance_status === 'absent' || Boolean(marks?.isExamAbsent);
      const isCatAbsent = Boolean(marks?.catAbsent);
      const hasCatMark = marks?.cat !== null && marks?.cat !== undefined;
      const hasExamMark = marks?.exam !== null && marks?.exam !== undefined;
      const hasAnyMark = Boolean(
        hasCatMark ||
        hasExamMark ||
        (marks?.assignment !== null && marks?.assignment !== undefined) ||
        (marks?.presentation !== null && marks?.presentation !== undefined) ||
        (marks?.rat !== null && marks?.rat !== undefined) ||
        (marks?.total !== null && marks?.total !== undefined),
      );
      const isCatMissing = !isAbsent && !isCatAbsent && !hasCatMark;

      return {
        rowId: row.id,
        studentId,
        admissionNumber: row.student?.admission_number ?? '—',
        fullName: row.student?.full_name ?? 'Unknown Student',
        cohortId: row.cohort?.id ?? '',
        cohortName: row.cohort?.name ?? row.cohort?.code ?? '—',
        isAbsent,
        isCatAbsent,
        hasCatMark,
        hasExamMark,
        hasAnyMark,
        isCatMissing,
        attendanceStatus: row.attendance_status,
        marks,
      };
    });
  }, [population, marksByStudent]);

  // Calculate telemetry & class averages from all candidates
  const stats = useMemo(() => {
    const satRows = rows.filter((r) => !r.isAbsent);
    const markedSatRows = satRows.filter((r) => r.hasAnyMark);

    let sumAssignment = 0;
    let countAssignment = 0;
    let sumPresentation = 0;
    let countPresentation = 0;
    let sumRat = 0;
    let countRat = 0;
    let sumCat = 0;
    let countCat = 0;
    let sumExam = 0;
    let countExam = 0;
    let sumTotal = 0;
    let countTotal = 0;

    let distinctionCount = 0;
    let creditCount = 0;
    let passCount = 0;
    let referCount = 0;
    let absentCount = rows.filter((r) => r.isAbsent || r.isCatAbsent).length;
    let catMarkedCount = 0;
    let catMissingCount = 0;
    let catPassCount = 0;

    for (const r of rows) {
      if (r.hasCatMark) {
        catMarkedCount += 1;
        if (r.marks?.cat !== null && r.marks?.cat !== undefined) {
          sumCat += r.marks.cat;
          countCat += 1;
          // CAT out of 15; pass mark is 40% (6/15)
          if (r.marks.cat >= 6) {
            catPassCount += 1;
          }
        }
      } else if (!r.isAbsent && !r.isCatAbsent) {
        catMissingCount += 1;
      }

      const m = r.marks;
      if (!m) continue;

      if (m.assignment !== null) {
        sumAssignment += m.assignment;
        countAssignment += 1;
      }
      if (m.presentation !== null) {
        sumPresentation += m.presentation;
        countPresentation += 1;
      }
      if (m.rat !== null) {
        sumRat += m.rat;
        countRat += 1;
      }
      if (m.exam !== null) {
        sumExam += m.exam;
        countExam += 1;
      }
      if (m.total !== null) {
        sumTotal += m.total;
        countTotal += 1;

        if (m.total >= 75) distinctionCount += 1;
        else if (m.total >= 65) creditCount += 1;
        else if (m.total >= passMark) passCount += 1;
        else referCount += 1;
      }
    }

    const meanTotal = countTotal > 0 ? Math.round(sumTotal / countTotal) : null;
    const meanCat = countCat > 0 ? Number((sumCat / countCat).toFixed(1)) : null;
    const passCountTotal = distinctionCount + creditCount + passCount;
    const passRate = countTotal > 0 ? Math.round((passCountTotal / countTotal) * 100) : null;
    const catPassRate = countCat > 0 ? Math.round((catPassCount / countCat) * 100) : null;

    return {
      totalCandidates: rows.length,
      satCandidates: satRows.length,
      absentCandidates: absentCount,
      markedCandidates: markedSatRows.length,
      catMarkedCount,
      catMissingCount,
      meanAssignment: countAssignment > 0 ? Math.round(sumAssignment / countAssignment) : null,
      meanPresentation: countPresentation > 0 ? Math.round(sumPresentation / countPresentation) : null,
      meanRat: countRat > 0 ? Math.round(sumRat / countRat) : null,
      meanCat,
      meanExam: countExam > 0 ? Math.round(sumExam / countExam) : null,
      meanTotal,
      passRate,
      catPassRate,
      passCountTotal,
      distinctionCount,
      creditCount,
      passCount,
      referCount,
    };
  }, [rows, passMark]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (q) {
        const matchesName = row.fullName.toLowerCase().includes(q);
        const matchesAdm = row.admissionNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesAdm) return false;
      }

      if (selectedCohort !== 'all' && row.cohortId !== selectedCohort) {
        return false;
      }

      if (selectedStatus === 'sat' && (row.isAbsent || row.isCatAbsent)) return false;
      if (selectedStatus === 'absent' && !row.isAbsent && !row.isCatAbsent) return false;
      if (selectedStatus === 'with-marks' && !row.hasAnyMark) return false;
      if (selectedStatus === 'missing-marks' && (row.isAbsent || (row.hasCatMark && row.hasExamMark))) return false;
      if (selectedStatus === 'cat-entered' && !row.hasCatMark) return false;
      if (selectedStatus === 'cat-missing' && !row.isCatMissing) return false;
      if (selectedStatus === 'cat-absent' && !row.isCatAbsent) return false;
      if (selectedStatus === 'exam-entered' && !row.hasExamMark) return false;

      return true;
    });
  }, [rows, searchQuery, selectedCohort, selectedStatus]);

  return (
    <section className="space-y-4">
      {/* Performance Summary Banner */}
      {stats.markedCandidates > 0 || stats.catMarkedCount > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Markbook Performance Overview
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {stats.catMarkedCount} of {stats.satCandidates} CAT marks recorded
                {stats.catMissingCount > 0 ? ` · ${stats.catMissingCount} candidate(s) missing marks` : ''}
                {marksSubmitted ? ' · Marks submitted by trainer' : isComplete ? ' · Assessment finalized' : ' · Draft / In Progress'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {stats.meanCat !== null ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50/90 px-3 py-1.5 border border-amber-300 shadow-2xs">
                  <span className="text-amber-800 font-bold">Mean CAT:</span>
                  <span className="font-black text-amber-950 font-mono">
                    {stats.meanCat} / 15
                  </span>
                </div>
              ) : null}
              {stats.meanTotal !== null ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50/90 px-3 py-1.5 border border-amber-300 shadow-2xs">
                  <span className="text-amber-800 font-bold">Mean Total:</span>
                  <span className="font-black text-amber-950 font-mono">
                    {stats.meanTotal} / {maxMark}
                  </span>
                </div>
              ) : null}
              {stats.passRate !== null ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200">
                  <span className="text-emerald-700 font-medium">Pass Rate:</span>
                  <span className="font-bold text-emerald-900">
                    {stats.passRate}% ({stats.passCountTotal}/{stats.markedCandidates})
                  </span>
                </div>
              ) : stats.catPassRate !== null ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200">
                  <span className="text-emerald-700 font-medium">CAT Pass Rate:</span>
                  <span className="font-bold text-emerald-900">
                    {stats.catPassRate}%
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Filters:</span>
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === 'cat-entered' ? 'all' : 'cat-entered')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer ${
                selectedStatus === 'cat-entered'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              CAT Recorded: {stats.catMarkedCount}
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === 'cat-missing' ? 'all' : 'cat-missing')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer ${
                selectedStatus === 'cat-missing'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              Missing CAT: {stats.catMissingCount}
            </button>
            {stats.absentCandidates > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'absent' ? 'all' : 'absent')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer ${
                  selectedStatus === 'absent'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Absent: {stats.absentCandidates}
              </button>
            ) : null}
            {stats.distinctionCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100/90 px-2.5 py-1 text-[11px] font-bold text-amber-950 border border-amber-300 shadow-2xs">
                Distinction: {stats.distinctionCount}
              </span>
            ) : null}
            {stats.creditCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 border border-teal-200">
                Credit: {stats.creditCount}
              </span>
            ) : null}
            {stats.passCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 border border-slate-300">
                Pass: {stats.passCount}
              </span>
            ) : null}
            {stats.referCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                Refer: {stats.referCount}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Sharing Cohorts Interactive Tabs */}
      {cohorts.length > 1 ? (
        <div
          role="tablist"
          aria-label="Filter candidates by sharing cohort"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100/80 p-1.5 shadow-2xs print:hidden"
        >
          <span className="flex items-center gap-1.5 px-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <Users className="size-3.5 text-slate-400" />
            Sharing Cohorts:
          </span>
          <button
            type="button"
            role="tab"
            aria-selected={selectedCohort === 'all'}
            onClick={() => setSelectedCohort('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
              selectedCohort === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>All Cohorts</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                selectedCohort === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {rows.length}
            </span>
          </button>

          {cohorts.map((c) => {
            const count = rows.filter((r) => r.cohortId === c.id).length;
            const isSelected = selectedCohort === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCohort(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
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

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Markbook
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cat')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                viewMode === 'cat'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>CAT Focus</span>
              {stats.catMissingCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    viewMode === 'cat' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stats.catMissingCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or admission no..."
              className="h-8.5 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Cohort Selector (if multiple cohorts) */}
          {cohorts.length > 1 ? (
            <div className="relative">
              <label htmlFor={cohortSelectId} className="sr-only">
                Filter by cohort
              </label>
              <select
                id={cohortSelectId}
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="h-8.5 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Cohorts ({cohorts.length})</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
            </div>
          ) : null}

          {/* Status Filter */}
          <div className="relative">
            <label htmlFor={statusSelectId} className="sr-only">
              Filter by status
            </label>
            <select
              id={statusSelectId}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8.5 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Candidates ({rows.length})</option>
              <option value="cat-entered">CAT Recorded ({stats.catMarkedCount})</option>
              <option value="cat-missing">CAT Pending / Missing ({stats.catMissingCount})</option>
              <option value="with-marks">With Any Marks Recorded ({stats.markedCandidates})</option>
              <option value="missing-marks">Incomplete / Missing Marks</option>
              <option value="cat-absent">CAT Absent (AB)</option>
              <option value="absent">All Absent (AB)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Right side: Count & Print */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Showing <strong className="text-slate-900">{filteredRows.length}</strong> of{' '}
            <strong className="text-slate-900">{population.length}</strong> candidates
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            title="Print markbook roster"
          >
            <Printer className="size-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Heading (visible on print only) */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h1 className="text-base font-bold text-slate-900">
          IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
        </h1>
        <p className="text-xs font-semibold text-slate-700">
          {viewMode === 'cat' || assessmentType === 'cat' ? 'CAT MARKSHEET' : 'FINAL EXAM MARKSHEET'} · {unitCode} {unitName}
        </p>
        <p className="text-[11px] text-slate-500">
          Academic Period: {periodName} · Total Candidates: {population.length}
        </p>
      </div>

      {/* Candidate Marks Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs">
        {viewMode === 'cat' ? (
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
              <tr>
                <th scope="col" className="w-12 px-3.5 py-2.5 text-center text-slate-500 whitespace-nowrap">No.</th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap min-w-[170px] text-slate-800">Admission No.</th>
                <th scope="col" className="px-3.5 py-2.5 min-w-[240px] whitespace-nowrap text-slate-900">Student Full Name</th>
                <th scope="col" className="px-3 py-2.5 whitespace-nowrap text-slate-700">Cohort</th>
                <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300">
                  CAT Mark <span className="text-[10px] font-bold text-amber-800">/15</span>
                </th>
                <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap">CAT Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">No candidates match your filter criteria.</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Try adjusting your search query or status filter above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const m = row.marks;
                  return (
                    <tr
                      key={row.rowId}
                      className={`transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35 ${
                        row.isCatMissing ? 'bg-amber-50/30' : row.isCatAbsent ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5 text-center font-medium text-slate-400 whitespace-nowrap">
                        {idx + 1}.
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-950 whitespace-nowrap min-w-[170px]">
                        {row.admissionNumber}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap min-w-[240px]">
                        {row.fullName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                          {row.cohortName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90 font-mono font-bold tabular-nums">
                        {row.isCatAbsent ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                            AB
                          </span>
                        ) : row.hasCatMark ? (
                          <span className="text-xs font-black text-amber-950">
                            {formatMark(m?.cat)}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {row.isCatAbsent ? (
                          <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Absent (AB)
                          </span>
                        ) : row.hasCatMark ? (
                          <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            ✓ Recorded
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                            ⚠ Missing / Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {stats.catMarkedCount > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-800">
                <tr>
                  <td colSpan={4} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-700 font-extrabold whitespace-nowrap">
                    Class CAT Average ({stats.catMarkedCount} candidates):
                  </td>
                  <td className="px-3 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                    {stats.meanCat !== null ? stats.meanCat : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] text-slate-600 font-bold">
                    {stats.catPassRate !== null ? `${stats.catPassRate}% Passed (≥6/15)` : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : (
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
              {assessmentType === 'exam' ? (
                <>
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

                  {/* Tier 2 Column Detail Header */}
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
                      Total <span className="text-[10px] font-bold text-amber-800">/{maxMark}</span>
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/50">Grade</th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th scope="col" className="w-12 px-3.5 py-2.5 text-center text-slate-500 whitespace-nowrap">No.</th>
                  <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap min-w-[170px] text-slate-800">Admission No.</th>
                  <th scope="col" className="px-3.5 py-2.5 min-w-[260px] whitespace-nowrap border-r-2 border-slate-300 text-slate-900">Student Full Name</th>
                  <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300">
                    CAT Mark <span className="text-[10px] font-bold text-amber-800">/{maxMark}</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/50">Grade</th>
                  <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap">Status</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={assessmentType === 'exam' ? 10 : 6}
                    className="px-4 py-12 text-center text-xs text-slate-500"
                  >
                    <p className="font-semibold text-slate-700">No candidates match your filter criteria.</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Try adjusting your search query or cohort filter above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const m = row.marks;
                  const isFinalized = marksSubmitted || Boolean(m?.isCommitted);
                  const isAbsent =
                    row.isAbsent ||
                    (assessmentType === 'exam' && isFinalized && (m?.exam === null || m?.exam === undefined));
                  const isCatAbsent =
                    row.isCatAbsent || (isFinalized && (m?.cat === null || m?.cat === undefined));

                  return (
                    <tr
                      key={row.rowId}
                      className={`transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35 ${
                        isAbsent ? 'bg-rose-50/30' : row.isCatMissing ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="px-3.5 py-2.5 text-center font-medium text-slate-400 whitespace-nowrap">
                        {idx + 1}.
                      </td>

                      {/* Admission No */}
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-950 whitespace-nowrap min-w-[170px]">
                        {row.admissionNumber}
                      </td>

                      {/* Full Name with vertical boundary wall - guaranteed no wrapping */}
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap min-w-[260px] border-r-2 border-slate-200">
                        {row.fullName}
                      </td>

                      {assessmentType === 'exam' ? (
                        <>
                          {/* Assignment /5 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(m?.assignment)}
                          </td>

                          {/* Presentation /10 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(m?.presentation)}
                          </td>

                          {/* RAT /15 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {formatMark(m?.rat)}
                          </td>

                          {/* CAT /15 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium tabular-nums border-r border-slate-200">
                            {isCatAbsent ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                AB
                              </span>
                            ) : row.hasCatMark ? (
                              <span className="text-slate-800 font-semibold">{formatMark(m?.cat)}</span>
                            ) : (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200" title="CAT mark not entered yet">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Exam /70 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium tabular-nums border-r border-slate-200">
                            {isAbsent ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                                AB
                              </span>
                            ) : (
                              <span className="text-slate-900 font-bold">{formatMark(m?.exam)}</span>
                            )}
                          </td>

                          {/* Total /100 — GOLDEN YELLOW SHADE COLUMN */}
                          <td className="px-2.5 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90">
                            {isAbsent ? (
                              <span className="text-[11px] font-bold text-rose-700">AB</span>
                            ) : m?.total !== null && m?.total !== undefined ? (
                              <span className="text-xs font-black text-amber-950 font-mono tabular-nums">
                                {formatMark(m.total)}
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
                            ) : m?.grade ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] ${getGradeBadgeClass(
                                  m.grade,
                                )}`}
                              >
                                {m.grade}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* CAT Mark — GOLDEN YELLOW SHADE */}
                          <td className="px-3 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90">
                            {isAbsent || isCatAbsent ? (
                              <span className="text-[11px] font-bold text-rose-700">AB</span>
                            ) : m?.cat !== null && m?.cat !== undefined ? (
                              <span className="text-xs font-black text-amber-950 font-mono tabular-nums">
                                {formatMark(m.cat)}
                              </span>
                            ) : (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/30">
                            {m?.grade ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] ${getGradeBadgeClass(
                                  m.grade,
                                )}`}
                              >
                                {m.grade}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {isAbsent ? (
                              <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                Absent (AB)
                              </span>
                            ) : (
                              <span className="inline-block rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                Expected / Sat
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Class Average */}
            {stats.markedCandidates > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-800">
                <tr>
                  <td colSpan={3} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-700 font-extrabold border-r-2 border-slate-300 whitespace-nowrap">
                    Class Average ({stats.markedCandidates} candidates):
                  </td>

                  {assessmentType === 'exam' ? (
                    <>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanAssignment)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanPresentation)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanRat)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums border-r border-slate-200">
                        {formatMark(stats.meanCat)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-900 font-mono font-black border-r border-slate-200">
                        {formatMark(stats.meanExam)}
                      </td>
                      {/* Golden Yellow Highlight on Total Average */}
                      <td className="px-2.5 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                        {formatMark(stats.meanTotal)}
                      </td>
                      <td className="px-3 py-3 text-center text-[10px] text-slate-700 bg-amber-50/40 font-bold">
                        {stats.meanTotal !== null
                          ? stats.meanTotal >= 75
                            ? 'DISTINCTION'
                            : stats.meanTotal >= 65
                            ? 'CREDIT'
                            : stats.meanTotal >= passMark
                            ? 'PASS'
                            : 'REFER'
                          : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Golden Yellow Highlight on CAT Average */}
                      <td className="px-3 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                        {formatMark(stats.meanCat)}
                      </td>
                      <td colSpan={2} className="px-3 py-3 text-center text-[10px] text-slate-600 bg-amber-50/40 font-bold">
                        {stats.passRate !== null ? `${stats.passRate}% Passed` : '—'}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            ) : null}
          </table>
        )}
      </div>
    </section>
  );
}
