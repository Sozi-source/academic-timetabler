'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Database,
  Search,
  UserX,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  BatchActionDialogs,
  type BatchActionType,
} from './batch-action-dialogs';
import type { RegistryCohortOption } from './queries';
import {
  StudentStatusStage,
  getStudentStageLabel,
  getStudentStatusLabel,
} from './student-status-stage';
import type { StudentRow } from './types';

type SortField = 'name' | 'programme' | 'cohort' | 'status';
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

  // Multi-select & Batch states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeModal, setActiveModal] = useState<BatchActionType | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Status Counts for Pill Badges
  const statusCounts = useMemo(() => {
    const counts = {
      all: students.length,
      active: 0,
      deferred: 0,
      dropped_out: 0,
      completed: 0,
      graduated: 0,
    };

    for (const student of students) {
      const status = student.lifecycle_status;
      if (status === 'active' || status === 'admitted') counts.active++;
      else if (status === 'deferred') counts.deferred++;
      else if (status === 'dropped_out') counts.dropped_out++;
      else if (status === 'completed') counts.completed++;
      else if (status === 'graduated') counts.graduated++;
    }

    return counts;
  }, [students]);

  // 1. Status Filter
  const statusFiltered = useMemo(() => {
    if (!activeStatus) return students;
    return students.filter((student) => {
      if (activeStatus === 'active') {
        return (
          student.lifecycle_status === 'active' ||
          student.lifecycle_status === 'admitted'
        );
      }
      return student.lifecycle_status === activeStatus;
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
      const progCode = (student.programme?.code ?? '').toLowerCase();
      const progName = (student.programme?.name ?? '').toLowerCase();
      const cohortName = (student.current_cohort?.name ?? '').toLowerCase();
      const cohortCode = (student.current_cohort?.code ?? '').toLowerCase();
      const statusLabel = getStudentStatusLabel(
        student.lifecycle_status,
        student.academic_phase,
      ).toLowerCase();
      const stageLabel = getStudentStageLabel(student).toLowerCase();

      return (
        name.includes(q) ||
        adm.includes(q) ||
        progCode.includes(q) ||
        progName.includes(q) ||
        cohortName.includes(q) ||
        cohortCode.includes(q) ||
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
      } else if (sortField === 'programme') {
        valA = a.programme?.code ?? '';
        valB = b.programme?.code ?? '';
      } else if (sortField === 'cohort') {
        valA = a.current_cohort?.name ?? '';
        valB = b.current_cohort?.name ?? '';
      } else if (sortField === 'status') {
        valA = getStudentStatusLabel(a.lifecycle_status, a.academic_phase);
        valB = getStudentStatusLabel(b.lifecycle_status, b.academic_phase);
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

  // Multi-selection Helpers
  const visibleIds = useMemo(
    () => paginatedStudents.map((s) => s.id),
    [paginatedStudents],
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedIds.has(s.id));
  }, [students, selectedIds]);

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

  const statusTabs = [
    { value: '', label: 'All', count: statusCounts.all },
    { value: 'active', label: 'Active', count: statusCounts.active },
    { value: 'deferred', label: 'Deferred', count: statusCounts.deferred },
    {
      value: 'dropped_out',
      label: 'Dropped out',
      count: statusCounts.dropped_out,
    },
    { value: 'completed', label: 'Completed', count: statusCounts.completed },
    { value: 'graduated', label: 'Graduated', count: statusCounts.graduated },
  ];

  const handleActionSuccess = (message: string) => {
    setBannerMessage(message);
    setSelectedIds(new Set());
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* SUCCESS CONFIRMATION BANNER */}
      {bannerMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md"
            aria-label="Dismiss message"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* STATUS FILTER PILLS & CONTROLS TOOLBAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Pills */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {statusTabs.map((tab) => {
            const isActive = activeStatus === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'border-primary bg-primary text-white shadow-xs'
                    : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-surface-subtle'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
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

        {/* Filters: Cohort Selector & Search Input */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cohort Dropdown Filter */}
          {cohorts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 h-9.5 text-xs">
              <UsersRound className="size-3.5 text-text-muted" />
              <select
                value={cohortFilter}
                onChange={(e) => {
                  setCohortFilter(e.target.value);
                  setPageIndex(0);
                }}
                className="bg-transparent text-xs font-semibold text-text-primary outline-none cursor-pointer max-w-[150px] sm:max-w-none"
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
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              type="text"
              placeholder="Search student or admission no..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageIndex(0);
              }}
              className="h-9.5 pl-9 pr-8 text-xs rounded-lg border-border-strong bg-surface focus:border-primary"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPageIndex(0);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
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
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
                >
                  Reset filters
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-xs">
          {/* Table Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border bg-surface-subtle px-4 py-3 gap-2">
            <div>
              <p className="text-sm font-bold text-text-primary">
                {activeStatus
                  ? `${activeStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Student Records`
                  : 'Current & Historical Student Records'}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Showing {sortedStudents.length} student
                {sortedStudents.length === 1 ? '' : 's'}
                {searchQuery ? ` matching "${searchQuery}"` : ''}
                {cohortFilter
                  ? ` in ${cohorts.find((c) => c.id === cohortFilter)?.name ?? 'cohort'}`
                  : ''}
              </p>
            </div>
            {searchQuery || cohortFilter ? (
              <Badge variant="neutral" className="text-xs">
                Filtered: {sortedStudents.length} of {statusFiltered.length}
              </Badge>
            ) : null}
          </div>

          {/* Select all matching banner */}
          {allVisibleSelected &&
            filteredStudents.length > pageSize &&
            selectedIds.size < filteredStudents.length && (
              <div className="border-b border-primary/20 bg-primary-subtle/40 px-4 py-2 text-center text-xs text-primary font-medium">
                All {visibleIds.length} students on this page are selected.{' '}
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="font-bold underline hover:text-primary-hover ml-1 cursor-pointer"
                >
                  Select all {filteredStudents.length} students matching filter
                </button>
              </div>
            )}

          {/* Desktop & Mobile Table View */}
          <div className="divide-y divide-border">
            {/* Desktop Column Titles with Sort Toggles */}
            <div className="hidden border-b border-border bg-surface px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted md:grid md:grid-cols-[36px_1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3">
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectVisible}
                  aria-label="Select all visible on page"
                  className="size-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => toggleSort('name')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
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
              <button
                type="button"
                onClick={() => toggleSort('programme')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Programme</span>
                {sortField === 'programme' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('cohort')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Cohort</span>
                {sortField === 'cohort' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('status')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Status / Stage</span>
                {sortField === 'status' ? (
                  sortOrder === 'asc' ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )
                ) : null}
              </button>
              <span aria-hidden="true" />
            </div>

            {/* Student Rows */}
            {paginatedStudents.map((student) => {
              const isSelected = selectedIds.has(student.id);
              return (
                <div
                  key={student.id}
                  className={`grid gap-2 px-4 py-3 text-xs transition md:grid md:grid-cols-[36px_1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3 ${
                    isSelected
                      ? 'bg-primary-subtle/30 hover:bg-primary-subtle/50'
                      : 'hover:bg-surface-subtle/80'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(student.id)}
                      aria-label={`Select ${student.full_name}`}
                      className="size-4 rounded border-border text-primary accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Student Details Link */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="min-w-0 group"
                  >
                    <p className="font-bold text-text-primary group-hover:text-primary transition">
                      {student.full_name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted whitespace-nowrap">
                      {student.admission_number}
                    </p>
                  </Link>

                  {/* Programme */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="min-w-0"
                  >
                    <p className="font-medium text-text-primary">
                      {student.programme?.code ?? 'Programme unavailable'}
                    </p>
                    {student.programme?.name ? (
                      <p className="mt-0.5 text-[10px] text-text-muted truncate max-w-48 sm:max-w-none">
                        {student.programme.name}
                      </p>
                    ) : null}
                  </Link>

                  {/* Current Study Cohort */}
                  <Link
                    href={`/students/registry/${student.id}`}
                    className="min-w-0"
                  >
                    <p className="font-medium text-text-primary">
                      {student.current_cohort?.name ?? 'Not assigned'}
                    </p>
                    {student.admission_cohort &&
                    student.current_cohort &&
                    student.admission_cohort.id !== student.current_cohort.id ? (
                      <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Adm: {student.admission_cohort.name}
                      </p>
                    ) : null}
                  </Link>

                  {/* Status / Stage */}
                  <Link href={`/students/registry/${student.id}`}>
                    <StudentStatusStage student={student} />
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
              );
            })}
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

      {/* STICKY BATCH ACTIONS TOOLBAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md max-w-3xl w-[calc(100%-2rem)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                selected
              </span>
            </div>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs font-medium text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Confirm Reported / Active */}
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveModal('confirm_reported')}
              className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-xs"
            >
              <CheckCircle2 className="size-3.5" />
              Confirm Reported
            </Button>

            {/* 2. Reassign Current Cohort (Repeaters) */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setActiveModal('reassign_cohort')}
              className="h-8 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border-slate-700 shadow-xs"
            >
              <UsersRound className="size-3.5" />
              Reassign Cohort
            </Button>

            {/* 3. Mark Deferred */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setActiveModal('defer')}
              className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border-none shadow-xs"
            >
              <Clock className="size-3.5" />
              Defer
            </Button>

            {/* 4. Mark Dropped Out */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setActiveModal('dropout')}
              className="h-8 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border-none shadow-xs"
            >
              <UserX className="size-3.5" />
              Dropped Out
            </Button>
          </div>
        </div>
      )}

      {/* BATCH ACTION DIALOGS MODAL */}
      <BatchActionDialogs
        openAction={activeModal}
        onClose={() => setActiveModal(null)}
        selectedStudents={selectedStudents}
        cohorts={cohorts}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
