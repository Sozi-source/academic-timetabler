'use client';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Search,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import type { RegistrationStudent } from './types';

interface StudentUnitRegistrationTableProps {
  students: RegistrationStudent[];
  academicPeriodId?: string | null;
}

function statusBadge(student: RegistrationStudent) {
  if (student.academicPhase === 'attachment') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Badge variant="neutral">Not eligible</Badge>
        <span className="text-[10px] text-text-muted">On attachment</span>
      </span>
    );
  }
  const { status, hasException, selectedUnits, expectedUnits } = student;
  if (status === 'verified') return <Badge variant="success">Verified</Badge>;
  if (status === 'submitted')
    return <Badge variant={hasException ? 'warning' : 'institutional'}>{hasException ? 'Review' : 'Submitted'}</Badge>;
  if (status === 'returned') return <Badge variant="warning">Returned</Badge>;
  if (selectedUnits >= expectedUnits && expectedUnits > 0) {
    return <Badge variant="success">Registered</Badge>;
  }
  if (selectedUnits > 0) {
    return <Badge variant="warning">Partial ({selectedUnits}/{expectedUnits})</Badge>;
  }
  return <Badge variant="neutral">Pending</Badge>;
}

export function StudentUnitRegistrationTable({
  students,
}: StudentUnitRegistrationTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Extract unique cohort names for filter dropdown
  const cohortOptions = useMemo(() => {
    const cohorts = new Set<string>();
    for (const student of students) {
      if (student.cohortName) cohorts.add(student.cohortName);
    }
    return Array.from(cohorts).sort();
  }, [students]);

  // Filter students based on search query, status, and cohort
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Search Query Filter (Name or Admission Number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = student.fullName.toLowerCase().includes(query);
        const matchesAdmission = student.admissionNumber.toLowerCase().includes(query);
        if (!matchesName && !matchesAdmission) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ineligible' && student.academicPhase !== 'attachment') return false;
        if (statusFilter === 'ineligible') return true;
        if (student.academicPhase === 'attachment') return false;
        if (statusFilter === 'registered' && (student.selectedUnits < student.expectedUnits || student.expectedUnits === 0)) return false;
        if (statusFilter === 'pending' && (student.selectedUnits > 0 || student.status !== 'not_submitted')) return false;
        if (statusFilter === 'submitted' && student.status !== 'submitted') return false;
        if (statusFilter === 'verified' && student.status !== 'verified') return false;
        if (statusFilter === 'returned' && student.status !== 'returned') return false;
      }

      // 3. Cohort Filter
      if (cohortFilter !== 'all') {
        if (student.cohortName !== cohortFilter) return false;
      }

      return true;
    });
  }, [students, searchQuery, statusFilter, cohortFilter]);

  // Pagination Logic
  const totalStudents = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalStudents);
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, startIndex, endIndex]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (cohortFilter !== 'all') params.set('cohort', cohortFilter);
    const query = params.toString();
    return `/api/students/unit-registration/export${query ? `?${query}` : ''}`;
  }, [searchQuery, statusFilter, cohortFilter]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleCohortChange = (value: string) => {
    setCohortFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Search Input & Filter Dropdowns (Business Central Command Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search student name or admission no..."
            className="h-8.5 w-full rounded-md border border-border bg-surface pl-8.5 pr-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 h-8.5 text-xs">
            <Filter className="size-3 text-text-muted" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="ineligible">Not eligible (attachment)</option>
              <option value="registered">Registered</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          {/* Cohort Filter */}
          {cohortOptions.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 h-8.5 text-xs">
              <UsersRound className="size-3 text-text-muted" aria-hidden="true" />
              <select
                value={cohortFilter}
                onChange={(e) => handleCohortChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer"
              >
                <option value="all">All Cohorts</option>
                {cohortOptions.map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {cohort}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 h-8.5 text-xs">
            <span className="text-text-muted">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-text-primary outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <a
            href={exportUrl}
            download
            className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-secondary shadow-xs transition hover:bg-surface-subtle"
            title="Export all matching unit registration records to Excel"
          >
            <Download className="size-3" aria-hidden="true" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {/* Results Table */}
      {paginatedStudents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-xs font-bold text-text-primary">No students match your filter criteria.</p>
          <p className="mt-1 text-[11px] text-text-muted">Try resetting your search query or status filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
          <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1.3fr] items-center gap-2.5 sm:gap-3 border-b border-border bg-surface-subtle px-3 py-2 sm:px-4 sm:py-2.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            <span>Student</span>
            <span className="text-center sm:text-left min-w-10 sm:min-w-0">Units</span>
            <span className="hidden sm:inline">Status</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-border-soft">
            {paginatedStudents.map((student) => (
              <div
                key={student.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1.3fr] items-center gap-2.5 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-primary-subtle/20 transition-colors"
              >
                {/* Student Info: Name (links to student details page) + Admission Number underneath */}
                <div className="min-w-0 pr-1">
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="truncate block text-xs font-bold text-text-primary hover:text-primary hover:underline transition-colors"
                    title="View student profile & details"
                  >
                    {student.fullName}
                  </Link>
                  <p className="truncate font-mono text-[11px] text-text-muted">{student.admissionNumber}</p>
                </div>

                {/* Units Registered */}
                <div className="text-center sm:text-left min-w-10 sm:min-w-0">
                  {student.academicPhase === 'attachment' ? (
                    <p className="text-[11px] text-text-muted sm:text-xs">N/A</p>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-text-primary whitespace-nowrap">
                        {student.selectedUnits} / {student.expectedUnits}
                      </p>
                      <p className="hidden text-[10px] text-text-muted sm:block">units assigned</p>
                    </>
                  )}
                </div>

                {/* Status Badge — hidden on small screen (viewable on student details page), visible on sm+ */}
                <div className="hidden sm:block">{statusBadge(student)}</div>

                {/* Action Buttons */}
                <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
                  {student.academicPhase !== 'attachment' && student.selectedUnits > 0 && (
                    <Link
                      href={`/students/registry/${student.id}/portal-view`}
                      className="hidden sm:inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-surface px-2 text-[11px] font-bold text-text-secondary hover:bg-surface-subtle transition active:scale-95"
                      title="View as Student (Portal Preview)"
                    >
                      <Eye className="size-3.5 text-primary" />
                      Portal
                    </Link>
                  )}

                  {student.academicPhase !== 'attachment' ? (
                    <Link
                      href={`/students/unit-registration/register/${student.id}`}
                      className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-2.5 sm:px-3 text-[11px] font-bold text-white shadow-2xs hover:bg-primary-hover transition active:scale-95"
                    >
                      <span>{student.status === 'verified' ? 'Manage' : 'Register'}</span>
                      <span className="hidden sm:inline">&nbsp;Units</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/students/registry/${student.id}`}
                      className="text-[11px] font-medium text-text-muted hover:text-text-primary hover:underline transition-colors"
                      title="View student profile & details"
                    >
                      Unavailable
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-subtle px-4 py-3 text-xs">
            <p className="text-text-muted">
              Showing <span className="font-bold text-text-primary">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-text-primary">{endIndex}</span> of{' '}
              <span className="font-bold text-text-primary">{totalStudents}</span> students
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={validPage === 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>

              <span className="px-2 text-xs font-bold text-text-primary">
                Page {validPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={validPage === totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
