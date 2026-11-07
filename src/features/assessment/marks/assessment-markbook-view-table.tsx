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
}

function formatMark(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  // Display cleanly: e.g. 12 or 12.5, at most 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
}: AssessmentMarkbookViewTableProps) {
  const searchInputId = useId();
  const cohortSelectId = useId();
  const statusSelectId = useId();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

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

      return {
        rowId: row.id,
        studentId,
        admissionNumber: row.student?.admission_number ?? '—',
        fullName: row.student?.full_name ?? 'Unknown Student',
        cohortId: row.cohort?.id ?? '',
        cohortName: row.cohort?.name ?? row.cohort?.code ?? '—',
        isAbsent,
        attendanceStatus: row.attendance_status,
        marks,
      };
    });
  }, [population, marksByStudent]);

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

      if (selectedStatus === 'sat' && row.isAbsent) return false;
      if (selectedStatus === 'absent' && !row.isAbsent) return false;
      if (selectedStatus === 'with-marks' && row.marks?.total === null) return false;
      if (selectedStatus === 'missing-marks' && (row.isAbsent || row.marks?.total !== null)) return false;

      return true;
    });
  }, [rows, searchQuery, selectedCohort, selectedStatus]);

  // Calculate telemetry & class averages from all marked, present students
  const stats = useMemo(() => {
    const satRows = rows.filter((r) => !r.isAbsent);
    const markedSatRows = satRows.filter((r) => r.marks?.total !== null && r.marks?.total !== undefined);

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
    let absentCount = rows.filter((r) => r.isAbsent).length;

    for (const r of markedSatRows) {
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
      if (m.cat !== null) {
        sumCat += m.cat;
        countCat += 1;
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

    const meanTotal = countTotal > 0 ? Math.round((sumTotal / countTotal) * 10) / 10 : null;
    const passCountTotal = distinctionCount + creditCount + passCount;
    const passRate = countTotal > 0 ? Math.round((passCountTotal / countTotal) * 100) : null;

    return {
      totalCandidates: rows.length,
      satCandidates: satRows.length,
      absentCandidates: absentCount,
      markedCandidates: markedSatRows.length,
      meanAssignment: countAssignment > 0 ? Math.round((sumAssignment / countAssignment) * 10) / 10 : null,
      meanPresentation: countPresentation > 0 ? Math.round((sumPresentation / countPresentation) * 10) / 10 : null,
      meanRat: countRat > 0 ? Math.round((sumRat / countRat) * 10) / 10 : null,
      meanCat: countCat > 0 ? Math.round((sumCat / countCat) * 10) / 10 : null,
      meanExam: countExam > 0 ? Math.round((sumExam / countExam) * 10) / 10 : null,
      meanTotal,
      passRate,
      passCountTotal,
      distinctionCount,
      creditCount,
      passCount,
      referCount,
    };
  }, [rows, passMark]);

  return (
    <section className="space-y-4">
      {/* Performance Summary Banner */}
      {stats.markedCandidates > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Markbook Performance Overview
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {stats.markedCandidates} of {stats.satCandidates} candidate results recorded
                {marksSubmitted ? ' · Marks submitted by trainer' : isComplete ? ' · Assessment finalized' : ' · Draft / In Progress'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200">
                <span className="text-slate-500 font-medium">Mean Total:</span>
                <span className="font-bold text-slate-900">
                  {stats.meanTotal !== null ? `${stats.meanTotal} / ${maxMark}` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200">
                <span className="text-emerald-700 font-medium">Pass Rate:</span>
                <span className="font-bold text-emerald-900">
                  {stats.passRate !== null ? `${stats.passRate}% (${stats.passCountTotal}/${stats.markedCandidates})` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Grade Distribution Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Grade Distribution:</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              Distinction: {stats.distinctionCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 border border-teal-200">
              Credit: {stats.creditCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 border border-slate-300">
              Pass: {stats.passCount}
            </span>
            {stats.referCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                Refer: {stats.referCount}
              </span>
            ) : null}
            {stats.absentCandidates > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 border border-rose-200">
                Absent: {stats.absentCandidates}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or admission number..."
              className="h-8.5 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
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
              <option value="all">All Candidates</option>
              <option value="sat">Sat Exam Only</option>
              <option value="absent">Absent (AB) Only</option>
              <option value="with-marks">With Marks Recorded</option>
              <option value="missing-marks">Pending Marks</option>
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
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
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
          {assessmentType === 'exam' ? 'FINAL EXAM MARKSHEET' : 'CAT MARKSHEET'} · {unitCode} {unitName}
        </p>
        <p className="text-[11px] text-slate-500">
          Academic Period: {periodName} · Total Candidates: {population.length}
        </p>
      </div>

      {/* Candidate Marks Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
            <tr>
              <th className="w-12 px-3 py-2.5 text-center">No.</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Admission No.</th>
              <th className="px-3 py-2.5 min-w-[180px]">Student Full Name</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Cohort</th>

              {assessmentType === 'exam' ? (
                <>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    Assignment <span className="text-[10px] font-normal text-slate-400">/5</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    Presentation <span className="text-[10px] font-normal text-slate-400">/10</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    RAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    CAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    Exam <span className="text-[10px] font-normal text-slate-400">/70</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-center whitespace-nowrap bg-slate-100/70 font-black text-slate-900">
                    Total <span className="text-[10px] font-normal text-slate-500">/{maxMark}</span>
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Grade</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Exam Status</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap bg-slate-100/70 font-black text-slate-900">
                    CAT Mark <span className="text-[10px] font-normal text-slate-500">/{maxMark}</span>
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Grade</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Status</th>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={assessmentType === 'exam' ? 12 : 7}
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
                const isAbsent = row.isAbsent;
                const isCatAbsent = Boolean(m?.catAbsent);

                return (
                  <tr
                    key={row.rowId}
                    className={`transition hover:bg-slate-50/80 ${
                      isAbsent ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="px-3 py-2.5 text-center font-medium text-slate-400">
                      {idx + 1}.
                    </td>

                    {/* Admission No */}
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.admissionNumber}
                    </td>

                    {/* Full Name */}
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {row.fullName}
                    </td>

                    {/* Cohort */}
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {row.cohortName}
                    </td>

                    {assessmentType === 'exam' ? (
                      <>
                        {/* Assignment /5 */}
                        <td className="px-2.5 py-2.5 text-center font-medium text-slate-700">
                          {formatMark(m?.assignment)}
                        </td>

                        {/* Presentation /10 */}
                        <td className="px-2.5 py-2.5 text-center font-medium text-slate-700">
                          {formatMark(m?.presentation)}
                        </td>

                        {/* RAT /15 */}
                        <td className="px-2.5 py-2.5 text-center font-medium text-slate-700">
                          {formatMark(m?.rat)}
                        </td>

                        {/* CAT /15 */}
                        <td className="px-2.5 py-2.5 text-center font-medium">
                          {isCatAbsent ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                              AB
                            </span>
                          ) : (
                            <span className="text-slate-700">{formatMark(m?.cat)}</span>
                          )}
                        </td>

                        {/* Exam /70 */}
                        <td className="px-2.5 py-2.5 text-center font-medium">
                          {isAbsent ? (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900">
                              AB
                            </span>
                          ) : (
                            <span className="text-slate-900 font-semibold">{formatMark(m?.exam)}</span>
                          )}
                        </td>

                        {/* Total /100 */}
                        <td className="px-2.5 py-2.5 text-center bg-slate-50/70">
                          {isAbsent ? (
                            <span className="text-[11px] font-bold text-rose-700">AB</span>
                          ) : m?.total !== null && m?.total !== undefined ? (
                            <span className="text-xs font-black text-slate-900">
                              {formatMark(m.total)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Grade */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
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

                        {/* Status */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {isAbsent ? (
                            <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              Exam Absent (AB)
                            </span>
                          ) : m?.isCommitted ? (
                            <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                              Submitted / Sat
                            </span>
                          ) : m?.total !== null && m?.total !== undefined ? (
                            <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              Draft Saved
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Expected / Sat
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* CAT Mark */}
                        <td className="px-3 py-2.5 text-center bg-slate-50/70">
                          {isAbsent || isCatAbsent ? (
                            <span className="text-[11px] font-bold text-rose-700">AB</span>
                          ) : m?.cat !== null && m?.cat !== undefined ? (
                            <span className="text-xs font-black text-slate-900">
                              {formatMark(m.cat)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Grade */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
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
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
              <tr>
                <td colSpan={4} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-600 font-extrabold">
                  Class Average ({stats.markedCandidates} candidates):
                </td>

                {assessmentType === 'exam' ? (
                  <>
                    <td className="px-2.5 py-3 text-center text-slate-700">
                      {formatMark(stats.meanAssignment)}
                    </td>
                    <td className="px-2.5 py-3 text-center text-slate-700">
                      {formatMark(stats.meanPresentation)}
                    </td>
                    <td className="px-2.5 py-3 text-center text-slate-700">
                      {formatMark(stats.meanRat)}
                    </td>
                    <td className="px-2.5 py-3 text-center text-slate-700">
                      {formatMark(stats.meanCat)}
                    </td>
                    <td className="px-2.5 py-3 text-center text-slate-900 font-black">
                      {formatMark(stats.meanExam)}
                    </td>
                    <td className="px-2.5 py-3 text-center bg-slate-100 font-black text-slate-900 text-xs">
                      {formatMark(stats.meanTotal)}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px] text-slate-600">
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
                    <td className="px-3 py-3 text-center text-[10px] text-slate-500 font-semibold">
                      {stats.passRate !== null ? `${stats.passRate}% Passed` : '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3 text-center bg-slate-100 font-black text-slate-900 text-xs">
                      {formatMark(stats.meanCat)}
                    </td>
                    <td colSpan={2} className="px-3 py-3 text-center text-[10px] text-slate-500 font-semibold">
                      {stats.passRate !== null ? `${stats.passRate}% Passed` : '—'}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
