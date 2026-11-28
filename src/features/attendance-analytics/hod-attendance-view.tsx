'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Search,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  attendanceRateLabel,
  COLLEGE_MINIMUM_ATTENDANCE_PERCENT,
  getAttendanceBadgeVariant,
  getAttendanceStanding,
  type AttendanceStanding,
} from './domain';
import type {
  DepartmentAttendanceAggregate,
  StudentAttendanceAggregate,
} from './types';

interface HodAttendanceViewProps {
  aggregates: DepartmentAttendanceAggregate[];
  students: StudentAttendanceAggregate[];
}

type TabMode = 'units' | 'students';
type StandingFilter = 'all' | 'at_risk' | 'borderline' | 'good';

export function HodAttendanceView({
  aggregates,
  students,
}: HodAttendanceViewProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [standingFilter, setStandingFilter] = useState<StandingFilter>('all');

  // Cohort options
  const cohortOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.cohortName) set.add(s.cohortName);
    }
    return Array.from(set).sort();
  }, [students]);

  // Standing counts for students
  const standingCounts = useMemo(() => {
    let atRisk = 0;
    let borderline = 0;
    let good = 0;

    for (const s of students) {
      const standing = getAttendanceStanding(s.attendanceRate);
      if (standing === 'at_risk') atRisk++;
      else if (standing === 'borderline') borderline++;
      else if (standing === 'good') good++;
    }

    return {
      total: students.length,
      atRisk,
      borderline,
      good,
    };
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return students.filter((s) => {
      // Cohort filter
      if (selectedCohort !== 'all' && s.cohortName !== selectedCohort) {
        return false;
      }

      // Standing filter
      if (standingFilter !== 'all') {
        const standing = getAttendanceStanding(s.attendanceRate);
        if (standingFilter !== standing) {
          return false;
        }
      }

      // Search query filter (name, admission number, or unit)
      if (query) {
        const matchName = s.fullName.toLowerCase().includes(query);
        const matchAdm = s.admissionNumber.toLowerCase().includes(query);
        const matchUnit = s.unitName.toLowerCase().includes(query);
        if (!matchName && !matchAdm && !matchUnit) {
          return false;
        }
      }

      return true;
    });
  }, [students, searchQuery, selectedCohort, standingFilter]);

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'students'
                ? 'bg-white text-primary shadow-2xs font-bold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="size-3.5" />
            Student Attendance ({students.length})
            {standingCounts.atRisk > 0 ? (
              <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                {standingCounts.atRisk} at risk
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'units'
                ? 'bg-white text-primary shadow-2xs font-bold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen className="size-3.5" />
            Unit Overview ({aggregates.length})
          </button>
        </div>

        {activeTab === 'students' && standingCounts.atRisk > 0 ? (
          <button
            type="button"
            onClick={() => setStandingFilter(standingFilter === 'at_risk' ? 'all' : 'at_risk')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              standingFilter === 'at_risk'
                ? 'border-rose-600 bg-rose-600 text-white shadow-2xs'
                : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className={`size-3.5 ${standingFilter === 'at_risk' ? 'text-white' : 'text-rose-600'}`} />
            {standingFilter === 'at_risk'
              ? `Showing ${standingCounts.atRisk} Student${standingCounts.atRisk === 1 ? '' : 's'} Below ${COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% (Click to show all)`
              : `View ${standingCounts.atRisk} Student${standingCounts.atRisk === 1 ? '' : 's'} Below ${COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%`}
          </button>
        ) : null}
      </div>

      {activeTab === 'students' ? (
        <div className="space-y-4">

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative min-w-[220px] max-w-[320px] flex-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search student or admission no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-white pl-8 pr-7 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Cohort Selector */}
              {cohortOptions.length > 0 ? (
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                >
                  <option value="all">All Cohorts ({cohortOptions.length})</option>
                  {cohortOptions.map((cohort) => (
                    <option key={cohort} value={cohort}>
                      {cohort}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {/* Standing Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStandingFilter('all')}
                className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  standingFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-surface-subtle text-text-secondary hover:bg-slate-200'
                }`}
              >
                All ({standingCounts.total})
              </button>

              <button
                type="button"
                onClick={() => setStandingFilter('at_risk')}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  standingFilter === 'at_risk'
                    ? 'bg-rose-700 text-white'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                At Risk &lt;80% ({standingCounts.atRisk})
              </button>

              <button
                type="button"
                onClick={() => setStandingFilter('borderline')}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  standingFilter === 'borderline'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Borderline 80–84% ({standingCounts.borderline})
              </button>

              <button
                type="button"
                onClick={() => setStandingFilter('good')}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  standingFilter === 'good'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Good ≥85% ({standingCounts.good})
              </button>
            </div>
          </div>

          {/* Student Table */}
          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No student records match filter"
              description="Try adjusting your search query, cohort selection, or attendance threshold."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-2xs">
              <TableContainer embedded label="Student attendance analytics">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Admission No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-center">Completed</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-right">Attendance Rate</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredStudents.map((s, idx) => {
                      const standing = getAttendanceStanding(s.attendanceRate);
                      const isAtRisk = standing === 'at_risk';

                      return (
                        <TableRow
                          key={`${s.studentId}-${s.unitId}-${idx}`}
                          className={isAtRisk ? 'bg-rose-50/30' : undefined}
                        >
                          <TableCell className="font-mono text-xs text-text-secondary">
                            {s.admissionNumber || '—'}
                          </TableCell>

                          <TableCell className="font-semibold text-text-primary">
                            {s.fullName}
                          </TableCell>

                          <TableCell className="text-text-secondary">
                            {s.cohortName}
                          </TableCell>

                          <TableCell className="font-medium text-text-primary">
                            {s.unitName}
                          </TableCell>

                          <TableCell className="text-center font-mono text-text-secondary">
                            {s.completedSessions}
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="inline-block min-w-[20px] rounded bg-emerald-50 px-1.5 py-0.5 font-mono font-bold text-emerald-700">
                              {s.presentCount}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <span
                              className={`inline-block min-w-[20px] rounded px-1.5 py-0.5 font-mono font-bold ${
                                s.absentCount > 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {s.absentCount}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {isAtRisk ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-800">
                                  <AlertTriangle className="size-3 text-rose-600" />
                                  {attendanceRateLabel(s.attendanceRate)} · At Risk
                                </span>
                              ) : (
                                <Badge variant={getAttendanceBadgeVariant(s.attendanceRate)}>
                                  {attendanceRateLabel(s.attendanceRate)}
                                  {standing === 'borderline' ? ' · Borderline' : ''}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <div className="border-t border-border bg-surface-subtle/50 px-4 py-2.5 text-xs text-text-muted flex items-center justify-between">
                <span>
                  Showing {filteredStudents.length} of {students.length} student record{students.length === 1 ? '' : 's'}
                </span>
                <span>
                  College Minimum Requirement: <strong>{COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Unit Overview Tab */
        <div className="space-y-4">
          {aggregates.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No completed attendance"
              description="Analytics will appear after trainers complete class attendance in the active academic period."
            />
          ) : (
            <TableContainer label="Unit attendance overview">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unit</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {aggregates.map((item) => (
                    <TableRow key={`${item.cohortId}:${item.unitId}:${item.trainerId}`}>
                      <TableCell className="font-semibold text-text-primary">
                        {item.unitName}
                      </TableCell>

                      <TableCell className="text-text-secondary">
                        {item.cohortName}
                      </TableCell>

                      <TableCell className="text-text-secondary">
                        {item.trainerName}
                      </TableCell>

                      <TableCell className="text-center font-mono text-text-primary">
                        {item.completedSessions}
                      </TableCell>

                      <TableCell className="text-center font-mono font-bold text-emerald-700">
                        {item.presentCount}
                      </TableCell>

                      <TableCell className="text-center font-mono font-bold text-rose-700">
                        {item.absentCount}
                      </TableCell>

                      <TableCell className="text-right">
                        <Badge variant={getAttendanceBadgeVariant(item.attendanceRate)}>
                          {attendanceRateLabel(item.attendanceRate)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      )}
    </div>
  );
}
