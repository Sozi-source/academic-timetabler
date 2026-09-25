'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Download,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import type { RegistryCohortOption } from './queries';
import {
  getStatusBadgeVariant,
  getStudentStageLabel,
  getStudentStatusLabel,
} from './student-status-stage';
import type { StudentRow } from './types';

type SortField = 'name' | 'status' | 'stage';
type SortOrder = 'asc' | 'desc';

interface StudentRegistryTableProps {
  students: StudentRow[];
  cohorts?: RegistryCohortOption[];
  initialStatus?: string;
}

export function StudentRegistryTable({
  students,
  cohorts = [],
  initialStatus,
}: StudentRegistryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active status tab state
  const activeStatus = searchParams.get('status') || initialStatus || '';

  // Filter & Search states
  const [cohortFilter, setCohortFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const statusCounts = useMemo(() => {
    const counts = {
      all: students.length,
      in_class: 0,
      on_attachment: 0,
      deferred: 0,
      dropped_out: 0,
      suspended: 0,
      completed: 0,
      graduated: 0,
    };

    for (const student of students) {
      const status = student.lifecycle_status;
      const phase = student.academic_phase;
      if (status === 'active' || status === 'admitted') {
        if (phase === 'attachment') counts.on_attachment++;
        else counts.in_class++;
      } else if (status === 'deferred') counts.deferred++;
      else if (status === 'dropped_out') counts.dropped_out++;
      else if (status === 'suspended') counts.suspended++;
      else if (status === 'completed') counts.completed++;
      else if (status === 'graduated') counts.graduated++;
    }

    return counts;
  }, [students]);

  // 1. Status Filter
  const statusFiltered = useMemo(() => {
    if (!activeStatus) return students;
    return students.filter((student) => {
      const status = student.lifecycle_status;
      const phase = student.academic_phase;
      if (activeStatus === 'in_class') {
        return (status === 'active' || status === 'admitted') && phase !== 'attachment';
      }
      if (activeStatus === 'on_attachment') {
        return (status === 'active' || status === 'admitted') && phase === 'attachment';
      }
      return status === activeStatus;
    });
  }, [students, activeStatus]);

  // 2. Cohort Filter & Search Query Filter
  const filteredStudents = useMemo(() => {
    let result = statusFiltered;

    if (cohortFilter) {
      result = result.filter(
        (student) =>
          student.current_cohort?.id === cohortFilter ||
          student.admission_cohort?.id === cohortFilter,
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter((student) => {
      const name = (student.full_name ?? '').toLowerCase();
      const adm = (student.admission_number ?? '').toLowerCase();
      const statusLabel = getStudentStatusLabel(
        student.lifecycle_status,
        student.academic_phase,
      ).toLowerCase();
      const stageLabel = getStudentStageLabel(student).toLowerCase();

      return (
        name.includes(q) ||
        adm.includes(q) ||
        statusLabel.includes(q) ||
        stageLabel.includes(q)
      );
    });
  }, [statusFiltered, cohortFilter, searchQuery]);

  // 3. Sorting
  const sortedStudents = useMemo(() => {
    const items = [...filteredStudents];
    items.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = a.full_name ?? '';
        valB = b.full_name ?? '';
      } else if (sortField === 'status') {
        valA = getStudentStatusLabel(a.lifecycle_status, a.academic_phase);
        valB = getStudentStatusLabel(b.lifecycle_status, b.academic_phase);
      } else if (sortField === 'stage') {
        valA = getStudentStageLabel(a);
        valB = getStudentStageLabel(b);
      }

      const cmp = valA.localeCompare(valB, 'en', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filteredStudents, sortField, sortOrder]);

  // 4. Paginated Slice
  const pageCount = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedStudents = useMemo(() => {
    const start = currentPageIndex * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, currentPageIndex, pageSize]);

  // Handle Tab Switch
  const handleTabChange = (value: string) => {
    setPageIndex(0);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('status', value);
    } else {
      params.delete('status');
    }
    router.push(
      `/students/registry${params.toString() ? `?${params.toString()}` : ''}`,
    );
  };

  // Sort Handler
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Single Dynamic Excel Export URL based on active filters
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (activeStatus) params.set('status', activeStatus);
    if (cohortFilter) params.set('cohortId', cohortFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    const qs = params.toString();
    return `/api/students/export${qs ? `?${qs}` : ''}`;
  }, [activeStatus, cohortFilter, searchQuery]);

  const statusTabs = [
    { value: '', label: 'All', count: statusCounts.all },
    { value: 'in_class', label: 'In Class', count: statusCounts.in_class },
    { value: 'on_attachment', label: 'On Attachment', count: statusCounts.on_attachment },
    { value: 'deferred', label: 'Deferred', count: statusCounts.deferred },
    {
      value: 'dropped_out',
      label: 'Dropped out',
      count: statusCounts.dropped_out,
    },
    { value: 'suspended', label: 'Suspended', count: statusCounts.suspended },
    { value: 'completed', label: 'Completed', count: statusCounts.completed },
    { value: 'graduated', label: 'Graduated', count: statusCounts.graduated },
  ];

  return (
    <div className="space-y-3">
      {/* STATUS FILTER PILLS & CONTROLS TOOLBAR */}
      <div className="rounded-xl border border-border-soft bg-surface p-3 shadow-2xs sm:p-4">
        <div className="flex flex-col gap-3">
          {/* Status filter — mobile: compact dropdown */}
          <div className="flex h-8.5 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-xs sm:hidden">
            <UsersRound className="size-3.5 shrink-0 text-text-muted" />
            <select
              value={activeStatus}
              onChange={(e) => handleTabChange(e.target.value)}
              className="w-full min-w-0 bg-transparent text-xs font-semibold text-text-primary outline-none"
            >
              {statusTabs.map((tab) => (
                <option key={tab.label} value={tab.value}>
                  {tab.label} ({tab.count})
                </option>
              ))}
            </select>
          </div>

          {/* Status Pills — sm: and up (Slim, compact styling) */}
          <div className="hidden sm:flex sm:flex-wrap sm:gap-1.5">
            {statusTabs.map((tab) => {
              const isActive = activeStatus === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => handleTabChange(tab.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-surface-subtle'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-subtle text-text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters: Cohort Selector, Search Input, and Single Excel Export */}
        <div className="mt-3 flex flex-col gap-2 border-t border-border-soft pt-3 sm:flex-row sm:items-center">
          {/* Cohort Dropdown Filter */}
          {cohorts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2 h-8.5 text-xs">
              <UsersRound className="size-3.5 text-text-muted" />
              <select
                value={cohortFilter}
                onChange={(e) => {
                  setCohortFilter(e.target.value);
                  setPageIndex(0);
                }}
                className="max-w-[14rem] bg-transparent text-xs font-semibold text-text-primary outline-none cursor-pointer"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.programmeCode ? `(${c.programmeCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Input Box */}
          <div className="relative w-full min-w-0 sm:w-auto sm:min-w-48 sm:flex-1 lg:max-w-[28rem]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              type="text"
              placeholder="Search student or adm no..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageIndex(0);
              }}
              className="h-8.5 pl-8 pr-7 text-xs rounded-lg border-border-strong bg-surface focus:border-primary"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPageIndex(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer p-0.5"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Single Excel Export Button (reacts to active filters) */}
          <a
            href={exportUrl}
            download
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition shrink-0 cursor-pointer shadow-2xs"
            title="Export filtered student list to Excel"
          >
            <Download className="size-3.5" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {/* REGISTRY DATA TABLE CARD */}
      {filteredStudents.length === 0 ? (
        <Card className="p-6 text-center">
          <EmptyState
            icon={Database}
            title={
              searchQuery || cohortFilter
                ? 'No matching students found'
                : 'No students in this status'
            }
            description={
              searchQuery || cohortFilter
                ? 'No student record matches your search or cohort filter. Try resetting your filter criteria.'
                : 'No student records were found under the selected status filter.'
            }
            action={
              searchQuery || cohortFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCohortFilter('');
                    setPageIndex(0);
                  }}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle cursor-pointer"
                >
                  Reset filters
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-2xs">
          {/* Table Header Bar (Slimmer height) */}
          <div className="flex flex-wrap items-center justify-between border-b border-border bg-surface-subtle px-3.5 py-2 gap-2">
            <div>
              <p className="text-xs font-bold text-text-primary sm:text-sm">
                {activeStatus
                  ? `${activeStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Student Records`
                  : 'Current & Historical Student Records'}
              </p>
              <p className="text-[11px] text-text-muted">
                Showing {sortedStudents.length} student
                {sortedStudents.length === 1 ? '' : 's'}
                {searchQuery ? ` matching "${searchQuery}"` : ''}
                {cohortFilter
                  ? ` in ${cohorts.find((c) => c.id === cohortFilter)?.name ?? 'cohort'}`
                  : ''}
              </p>
            </div>
            {searchQuery || cohortFilter ? (
              <Badge variant="neutral" className="text-[10px] px-2 py-0 min-h-5">
                Filtered: {sortedStudents.length} of {statusFiltered.length}
              </Badge>
            ) : null}
          </div>

          {/* Desktop & Mobile Table View */}
          <div className="divide-y divide-border">
            {/* Desktop Column Titles with Sort Toggles (Slimmer height) */}
            <div className="hidden border-b border-border bg-surface px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted md:grid md:grid-cols-[minmax(10rem,2fr)_minmax(11rem,1.5fr)_minmax(7rem,1fr)_minmax(6rem,0.8fr)_1.5rem] md:items-center md:gap-3">
              <button
                type="button"
                onClick={() => toggleSort('name')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary cursor-pointer"
              >
                <span>Student</span>
                {sortField === 'name' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>

              <span>Admission Number</span>

              <button
                type="button"
                onClick={() => toggleSort('status')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary cursor-pointer"
              >
                <span>Status</span>
                {sortField === 'status' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => toggleSort('stage')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary cursor-pointer"
              >
                <span>Stage</span>
                {sortField === 'stage' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>

              <span aria-hidden="true" />
            </div>

            {/* Student Rows — mobile: native stacked cards (Slimmer padding) */}
            <div className="divide-y divide-border/70 md:hidden">
              {paginatedStudents.map((student) => (
                <div
                  key={student.id}
                  className="px-3.5 py-2 text-xs transition hover:bg-surface-subtle/80"
                >
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12.5px] font-semibold leading-tight text-[#35534f]">
                        {student.full_name}
                      </p>
                      <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                    </div>

                    <p className="mt-0.5 font-mono text-[10.5px] text-text-muted leading-tight">
                      {student.admission_number}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <Badge
                        variant={getStatusBadgeVariant(student.lifecycle_status, student.academic_phase)}
                        className="text-[10px] px-2 py-0 min-h-5"
                      >
                        {getStudentStatusLabel(student.lifecycle_status, student.academic_phase)}
                      </Badge>
                      <span className="text-[11px] font-semibold text-text-secondary">
                        {getStudentStageLabel(student)}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Student Rows — md and up: dense slim grid rows */}
            <div className="hidden divide-y divide-border/70 md:block">
              {paginatedStudents.map((student) => (
                <div
                  key={student.id}
                  className="grid items-center gap-3 px-4 py-2.5 text-xs transition hover:bg-surface-subtle/80 md:grid-cols-[minmax(10rem,2fr)_minmax(11rem,1.5fr)_minmax(7rem,1fr)_minmax(6rem,0.8fr)_1.5rem]"
                >
                  {/* Student Details Link */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="min-w-0 group"
                  >
                    <p className="font-semibold tracking-[0.005em] text-[#35534f] group-hover:text-primary transition truncate leading-tight">
                      {student.full_name}
                    </p>
                  </Link>

                  {/* Admission Number */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="font-mono text-[11px] text-text-secondary whitespace-nowrap"
                  >
                    {student.admission_number}
                  </Link>

                  {/* Status */}
                  <Link href={`/students/registry/${student.id}`}>
                    <Badge
                      variant={getStatusBadgeVariant(student.lifecycle_status, student.academic_phase)}
                      className="text-[10px] px-2 py-0 min-h-5 inline-flex"
                    >
                      {getStudentStatusLabel(student.lifecycle_status, student.academic_phase)}
                    </Badge>
                  </Link>

                  {/* Stage */}
                  <Link href={`/students/registry/${student.id}`}>
                    <span className="font-semibold text-text-secondary text-xs">
                      {getStudentStageLabel(student)}
                    </span>
                  </Link>

                  {/* Arrow Icon */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="flex justify-end text-text-muted hover:text-text-primary"
                    aria-label={`Open details for ${student.full_name}`}
                  >
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* PAGINATION FOOTER */}
          <Pagination
            pageIndex={currentPageIndex}
            pageCount={pageCount}
            pageSize={pageSize}
            totalRows={sortedStudents.length}
            canPreviousPage={currentPageIndex > 0}
            canNextPage={currentPageIndex < pageCount - 1}
            onFirstPage={() => setPageIndex(0)}
            onPreviousPage={() => setPageIndex((p) => Math.max(0, p - 1))}
            onNextPage={() =>
              setPageIndex((p) => Math.min(pageCount - 1, p + 1))
            }
            onLastPage={() => setPageIndex(pageCount - 1)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPageIndex(0);
            }}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </Card>
      )}
    </div>
  );
}
