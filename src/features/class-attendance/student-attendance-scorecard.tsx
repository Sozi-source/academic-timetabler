'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  Download,
  Filter,
  GraduationCap,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  User,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import {
  COLLEGE_MINIMUM_ATTENDANCE_PERCENT,
  attendanceRateLabel,
  getAttendanceBadgeVariant,
  getAttendanceStanding,
  getAttendanceStandingLabel,
  type AttendanceStanding,
} from '@/features/attendance-analytics/domain';
import type {
  AttendanceScorecardCohortOption,
  AttendanceScorecardUnitColumn,
  StudentAttendanceScorecardData,
  StudentAttendanceScorecardItem,
  StudentUnitAttendanceScore,
} from './scorecard-types';

interface StudentAttendanceScorecardProps {
  scorecardData: StudentAttendanceScorecardData;
}

type StandingFilter = 'all' | 'at_risk' | 'borderline' | 'good' | 'unrecorded';
type SortField = 'overall_asc' | 'overall_desc' | 'name_asc' | 'admission_asc';
type ViewMode = 'matrix' | 'cards';

export function StudentAttendanceScorecard({ scorecardData }: StudentAttendanceScorecardProps) {
  const { students, cohorts, allUnits, stats, academicPeriodName } = scorecardData;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [standingFilter, setStandingFilter] = useState<StandingFilter>('all');
  const [sortField, setSortField] = useState<SortField>('overall_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [inspectedStudent, setInspectedStudent] = useState<StudentAttendanceScorecardItem | null>(null);

  // Dynamic unit columns for the selected scope
  const activeUnitColumns = useMemo(() => {
    if (selectedCohortId === 'all') {
      return allUnits;
    }
    // Find all distinct units taken by students in this cohort
    const cohortUnitMap = new Map<string, AttendanceScorecardUnitColumn>();
    for (const student of students) {
      if (student.cohortId === selectedCohortId) {
        for (const u of student.units) {
          cohortUnitMap.set(u.unitId, { id: u.unitId, code: u.unitCode, name: u.unitName });
        }
      }
    }
    return Array.from(cohortUnitMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [allUnits, selectedCohortId, students]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = students.filter((s) => {
      // 1. Cohort filter
      if (selectedCohortId !== 'all' && s.cohortId !== selectedCohortId) {
        return false;
      }

      // 2. Standing filter
      if (standingFilter !== 'all') {
        if (standingFilter !== s.standing) {
          return false;
        }
      }

      // 3. Search query filter (matches name, admission no, cohort, or unit codes)
      if (query) {
        const matchName = s.fullName.toLowerCase().includes(query);
        const matchAdm = s.admissionNumber.toLowerCase().includes(query);
        const matchCohort = s.cohortName.toLowerCase().includes(query);
        const matchUnit = s.units.some((u) =>
          u.unitCode.toLowerCase().includes(query) || u.unitName.toLowerCase().includes(query),
        );
        if (!matchName && !matchAdm && !matchCohort && !matchUnit) {
          return false;
        }
      }

      return true;
    });

    // Sort students
    return filtered.sort((a, b) => {
      switch (sortField) {
        case 'overall_asc': {
          if (a.overallScore === null && b.overallScore === null) return 0;
          if (a.overallScore === null) return 1;
          if (b.overallScore === null) return -1;
          return a.overallScore - b.overallScore;
        }
        case 'overall_desc': {
          if (a.overallScore === null && b.overallScore === null) return 0;
          if (a.overallScore === null) return 1;
          if (b.overallScore === null) return -1;
          return b.overallScore - a.overallScore;
        }
        case 'name_asc':
          return a.fullName.localeCompare(b.fullName);
        case 'admission_asc':
          return a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true, sensitivity: 'base' });
        default:
          return 0;
      }
    });
  }, [students, searchQuery, selectedCohortId, standingFilter, sortField]);

  // Export to CSV function
  const handleExportCsv = () => {
    if (filteredStudents.length === 0) return;

    const headers = [
      'Admission No',
      'Student Name',
      'Cohort',
      'Programme',
      ...activeUnitColumns.map((u) => `${u.code} (%)`),
      'Overall Attendance (%)',
      'Standing',
      'Total Sessions Attended',
      'Total Sessions Held',
    ];

    const rows = filteredStudents.map((s) => {
      const unitMap = new Map(s.units.map((u) => [u.unitId, u]));
      const unitValues = activeUnitColumns.map((col) => {
        const u = unitMap.get(col.id);
        if (!u) return 'N/A';
        return u.attendanceRate !== null ? `${u.attendanceRate.toFixed(1)}%` : 'No sessions';
      });

      return [
        `"${s.admissionNumber}"`,
        `"${s.fullName}"`,
        `"${s.cohortName}"`,
        `"${s.programmeCode}"`,
        ...unitValues.map((v) => `"${v}"`),
        s.overallScore !== null ? `"${s.overallScore.toFixed(1)}%"` : '"Unrecorded"',
        `"${getAttendanceStandingLabel(s.standing)}"`,
        s.totalPresent,
        s.totalCompletedSessions,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Student-Attendance-Scorecard-${selectedCohortId === 'all' ? 'All-Cohorts' : 'Cohort'}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Tracked Active Students"
          value={String(stats.totalStudents)}
          icon={Users}
          description="Enrolled in active department cohorts"
        />

        <MetricCard
          label="Department Avg Attendance"
          value={attendanceRateLabel(stats.averageAttendanceRate)}
          icon={BookOpen}
          description="Average across completed unit sessions"
        />

        <MetricCard
          label="Good Standing (≥80%)"
          value={String(stats.goodStandingCount)}
          icon={CheckCircle2}
          description="Cleared for examinations"
        />

        <MetricCard
          label="At Risk (<80%)"
          value={String(stats.atRiskCount)}
          icon={AlertTriangle}
          description="Below mandatory college policy"
        />
      </div>

      {/* Policy Alert Banner if students are at risk */}
      {stats.atRiskCount > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-950 shadow-2xs">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <div className="flex-1 space-y-1">
            <p className="font-bold">
              Mandatory Minimum Attendance Policy: {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%
            </p>
            <p className="text-rose-900/90 text-[11px] leading-relaxed">
              <strong>{stats.atRiskCount} active student{stats.atRiskCount === 1 ? '' : 's'}</strong> are currently below the required {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% attendance threshold across their registered units. Filter by &ldquo;At Risk&rdquo; below to review unit-by-unit attendance breakdowns or print warning registers.
            </p>
          </div>
          {standingFilter !== 'at_risk' && (
            <button
              type="button"
              onClick={() => setStandingFilter('at_risk')}
              className="shrink-0 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-800 transition"
            >
              Filter At-Risk Students
            </button>
          )}
        </div>
      ) : null}

      {/* Search, Filter & Controls Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[240px] max-w-[340px] flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search by student name or admission no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-border bg-surface-subtle pl-8 pr-7 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2.5 text-text-muted hover:text-text-primary"
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {/* Cohort Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="cohort-select" className="text-[11px] font-semibold text-text-secondary whitespace-nowrap">
                Cohort:
              </label>
              <select
                id="cohort-select"
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="h-8.5 rounded-lg border border-border bg-surface-subtle px-2.5 text-xs font-medium text-text-primary focus:border-primary focus:bg-white focus:outline-none transition"
              >
                <option value="all">All Cohorts ({cohorts.length})</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name} ({cohort.studentCount} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="sort-select" className="text-[11px] font-semibold text-text-secondary whitespace-nowrap">
                Sort:
              </label>
              <select
                id="sort-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="h-8.5 rounded-lg border border-border bg-surface-subtle px-2.5 text-xs font-medium text-text-primary focus:border-primary focus:bg-white focus:outline-none transition"
              >
                <option value="overall_asc">Attendance % (Lowest first)</option>
                <option value="overall_desc">Attendance % (Highest first)</option>
                <option value="name_asc">Student Name (A–Z)</option>
                <option value="admission_asc">Admission No</option>
              </select>
            </div>
          </div>

          {/* View Mode & Export Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-surface-subtle p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'matrix'
                    ? 'bg-white text-primary shadow-2xs font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Table Matrix view"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden md:inline">Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'cards'
                    ? 'bg-white text-primary shadow-2xs font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Card list view"
              >
                <List className="size-3.5" />
                <span className="hidden md:inline">Scorecards</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredStudents.length === 0}
              className="h-8.5 text-xs font-semibold gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Standing Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <span className="text-[11px] font-semibold text-text-muted mr-1">Status:</span>

          <button
            type="button"
            onClick={() => setStandingFilter('all')}
            className={`h-6.5 rounded-md px-2.5 text-[11px] font-semibold transition ${
              standingFilter === 'all'
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-surface-subtle text-text-secondary hover:bg-slate-200'
            }`}
          >
            All Students ({stats.totalStudents})
          </button>

          <button
            type="button"
            onClick={() => setStandingFilter('at_risk')}
            className={`inline-flex h-6.5 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
              standingFilter === 'at_risk'
                ? 'bg-rose-700 text-white font-bold'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            At Risk &lt;80% ({stats.atRiskCount})
          </button>

          <button
            type="button"
            onClick={() => setStandingFilter('borderline')}
            className={`inline-flex h-6.5 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
              standingFilter === 'borderline'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Borderline 80–84% ({stats.borderlineCount})
          </button>

          <button
            type="button"
            onClick={() => setStandingFilter('good')}
            className={`inline-flex h-6.5 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
              standingFilter === 'good'
                ? 'bg-emerald-700 text-white font-bold'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Good Standing ≥85% ({stats.goodStandingCount})
          </button>

          <button
            type="button"
            onClick={() => setStandingFilter('unrecorded')}
            className={`inline-flex h-6.5 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
              standingFilter === 'unrecorded'
                ? 'bg-slate-700 text-white font-bold'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            Unrecorded ({stats.unrecordedCount})
          </button>

          {filteredStudents.length !== stats.totalStudents && (
            <span className="ml-auto text-[11px] text-text-muted italic">
              Showing {filteredStudents.length} of {stats.totalStudents} students
            </span>
          )}
        </div>
      </div>

      {/* Main Content View */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No student records match filter"
          description="Try clearing your search query, selecting another cohort, or adjusting the attendance status threshold."
        />
      ) : viewMode === 'matrix' ? (
        /* Matrix Grid View: Shows Subjects as Columns with Scores & Overall Average at the End */
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="border-b border-border bg-surface-subtle text-[9px] font-bold uppercase tracking-wider text-text-muted sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-3 whitespace-nowrap bg-surface-subtle sticky left-0 z-20 border-r border-border">
                    Admission No
                  </th>
                  <th className="px-3.5 py-3 whitespace-nowrap bg-surface-subtle border-r border-border">
                    Student Name
                  </th>
                  <th className="px-3 py-3 whitespace-nowrap border-r border-border">
                    Cohort
                  </th>

                  {/* Dynamic Unit Column Headers */}
                  {activeUnitColumns.map((col) => (
                    <th
                      key={col.id}
                      className="px-3 py-3 text-center whitespace-nowrap border-r border-border max-w-[130px]"
                      title={`${col.code}: ${col.name}`}
                    >
                      <div className="truncate font-mono font-bold text-text-primary">{col.code}</div>
                      <div className="truncate font-normal text-[8px] text-text-muted lowercase">{col.name}</div>
                    </th>
                  ))}

                  {/* Pinned Overall Score & Standing Column */}
                  <th className="px-4 py-3 text-right whitespace-nowrap bg-emerald-50/50 text-emerald-950 font-extrabold sticky right-0 z-20 border-l border-border">
                    Overall Score (%)
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredStudents.map((student) => {
                  const unitMap = new Map<string, StudentUnitAttendanceScore>(
                    student.units.map((u) => [u.unitId, u]),
                  );
                  const isAtRisk = student.standing === 'at_risk';
                  const isGood = student.standing === 'good';

                  return (
                    <tr
                      key={student.studentId}
                      onClick={() => setInspectedStudent(student)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                        isAtRisk ? 'bg-rose-50/25' : ''
                      }`}
                    >
                      {/* Admission No (sticky left) */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] font-semibold text-text-secondary whitespace-nowrap sticky left-0 z-10 bg-white border-r border-border">
                        {student.admissionNumber || '—'}
                      </td>

                      {/* Student Name */}
                      <td className="px-3.5 py-2.5 font-semibold text-text-primary whitespace-nowrap border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <span>{student.fullName}</span>
                          {isAtRisk ? (
                            <span className="inline-block size-2 rounded-full bg-rose-500" title="At Risk (< 80%)" />
                          ) : isGood ? (
                            <span className="inline-block size-2 rounded-full bg-emerald-500" title="Good Standing" />
                          ) : null}
                        </div>
                      </td>

                      {/* Cohort */}
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap text-[10.5px] border-r border-border">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                          {student.cohortName}
                        </span>
                      </td>

                      {/* Unit Score Cells */}
                      {activeUnitColumns.map((col) => {
                        const unitScore = unitMap.get(col.id);

                        if (!unitScore) {
                          return (
                            <td key={col.id} className="px-2 py-2 text-center text-text-muted/40 border-r border-border font-mono text-[10px]">
                              —
                            </td>
                          );
                        }

                        if (unitScore.attendanceRate === null) {
                          return (
                            <td key={col.id} className="px-2 py-2 text-center border-r border-border" title="No completed sessions recorded">
                              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">
                                0 ses
                              </span>
                            </td>
                          );
                        }

                        const rate = unitScore.attendanceRate;
                        const isUnitAtRisk = rate < COLLEGE_MINIMUM_ATTENDANCE_PERCENT;
                        const isUnitGood = rate >= 85.0;

                        return (
                          <td
                            key={col.id}
                            className={`px-2 py-2 text-center border-r border-border font-mono text-[10.5px] font-bold ${
                              isUnitAtRisk
                                ? 'bg-rose-50/60 text-rose-700'
                                : isUnitGood
                                  ? 'bg-emerald-50/30 text-emerald-800'
                                  : 'text-amber-800'
                            }`}
                            title={`${unitScore.unitCode}: ${unitScore.presentCount}/${unitScore.presentCount + unitScore.absentCount} sessions attended (${rate.toFixed(1)}%)`}
                          >
                            <span className="inline-block min-w-[36px] rounded px-1 py-0.5">
                              {rate.toFixed(1)}%
                            </span>
                          </td>
                        );
                      })}

                      {/* Pinned Overall Score Cell (sticky right) */}
                      <td className="px-4 py-2.5 text-right whitespace-nowrap sticky right-0 z-10 bg-white border-l border-border">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`font-mono text-xs font-black ${
                              isAtRisk
                                ? 'text-rose-700'
                                : isGood
                                  ? 'text-emerald-800'
                                  : student.overallScore !== null
                                    ? 'text-amber-700'
                                    : 'text-text-muted'
                            }`}
                          >
                            {student.overallScore !== null ? `${student.overallScore.toFixed(1)}%` : '—'}
                          </span>

                          <Badge variant={getAttendanceBadgeVariant(student.overallScore)} className="text-[10px] py-0 px-1.5">
                            {student.standing === 'good'
                              ? 'Eligible'
                              : student.standing === 'borderline'
                                ? 'Warn'
                                : student.standing === 'at_risk'
                                  ? 'At Risk'
                                  : 'None'}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card / List View: Renders detailed scorecards per student */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredStudents.map((student) => {
            const isAtRisk = student.standing === 'at_risk';

            return (
              <div
                key={student.studentId}
                onClick={() => setInspectedStudent(student)}
                className={`cursor-pointer rounded-2xl border bg-white p-4.5 shadow-2xs transition hover:shadow-xs hover:border-primary/40 ${
                  isAtRisk ? 'border-rose-200 bg-rose-50/15' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-text-primary">{student.fullName}</h4>
                      <Badge variant={getAttendanceBadgeVariant(student.overallScore)}>
                        {getAttendanceStandingLabel(student.standing)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="font-mono font-semibold text-text-secondary">{student.admissionNumber}</span>
                      <span>•</span>
                      <span>{student.cohortName}</span>
                      {student.programmeCode && (
                        <>
                          <span>•</span>
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[10px] font-bold text-slate-700">
                            {student.programmeCode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Overall Attendance</div>
                    <div
                      className={`font-mono text-lg font-black ${
                        isAtRisk ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                    >
                      {student.overallScore !== null ? `${student.overallScore.toFixed(1)}%` : '—'}
                    </div>
                    <div className="text-[10.5px] text-text-muted">
                      {student.totalPresent}/{student.totalCompletedSessions} sessions
                    </div>
                  </div>
                </div>

                {/* Units List */}
                <div className="mt-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Subjects & Attendance ({student.units.length} units registered)
                  </div>

                  {student.units.length === 0 ? (
                    <p className="text-xs text-text-muted italic">No unit registrations found for this academic period.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {student.units.map((unit) => {
                        const isUnitAtRisk = unit.attendanceRate !== null && unit.attendanceRate < COLLEGE_MINIMUM_ATTENDANCE_PERCENT;

                        return (
                          <div
                            key={unit.unitId}
                            className={`flex items-center justify-between rounded-xl border p-2 text-xs transition ${
                              isUnitAtRisk
                                ? 'border-rose-200 bg-rose-50/70 text-rose-950'
                                : 'border-border bg-surface-subtle/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="font-mono font-bold text-text-primary text-[11px] truncate">
                                {unit.unitCode}
                              </div>
                              <div className="text-[10px] text-text-muted truncate">{unit.unitName}</div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isUnitAtRisk
                                    ? 'text-rose-700'
                                    : unit.attendanceRate !== null
                                      ? 'text-emerald-800'
                                      : 'text-text-muted'
                                }`}
                              >
                                {unit.attendanceRate !== null ? `${unit.attendanceRate.toFixed(1)}%` : '—'}
                              </span>
                              <div className="text-[9.5px] text-text-muted">
                                {unit.presentCount}/{unit.completedSessions} ses
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Inspector Drawer / Modal */}
      {inspectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setInspectedStudent(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-start gap-3 border-b border-border pb-4">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <User className="size-6" />
              </div>
              <div className="flex-1 pr-6">
                <h3 className="text-base font-bold text-text-primary">{inspectedStudent.fullName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1 font-mono">
                  <span>{inspectedStudent.admissionNumber}</span>
                  <span>•</span>
                  <span>{inspectedStudent.cohortName}</span>
                </div>
              </div>
            </div>

            {/* Scorecard Overview */}
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-surface-subtle p-3.5 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted">Overall Rate</div>
                <div className="font-mono text-lg font-black text-primary">
                  {inspectedStudent.overallScore !== null ? `${inspectedStudent.overallScore.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted">Sessions Attended</div>
                <div className="font-mono text-lg font-bold text-text-primary">
                  {inspectedStudent.totalPresent} / {inspectedStudent.totalCompletedSessions}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-text-muted">Standing</div>
                <div className="mt-1">
                  <Badge variant={getAttendanceBadgeVariant(inspectedStudent.overallScore)}>
                    {getAttendanceStandingLabel(inspectedStudent.standing)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Unit Breakdown */}
            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <div className="text-xs font-bold uppercase text-text-muted">Subjects Breakdown ({inspectedStudent.units.length})</div>
              {inspectedStudent.units.map((u) => {
                const isUnitAtRisk = u.attendanceRate !== null && u.attendanceRate < COLLEGE_MINIMUM_ATTENDANCE_PERCENT;

                return (
                  <div
                    key={u.unitId}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                      isUnitAtRisk ? 'border-rose-200 bg-rose-50/60' : 'border-border bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-text-primary">{u.unitCode}</div>
                      <div className="text-[11px] text-text-secondary">{u.unitName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-text-primary">
                        {u.attendanceRate !== null ? `${u.attendanceRate.toFixed(1)}%` : 'No sessions'}
                      </div>
                      <div className="text-[10.5px] text-text-muted">
                        {u.presentCount} present · {u.absentCount} absent
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setInspectedStudent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
