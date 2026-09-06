'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronUp, ChevronDown, Database, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
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
  initialStatus?: string;
}

export function StudentRegistryTable({
  students,
  initialStatus,
}: StudentRegistryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active status tab state
  const activeStatus = searchParams.get('status') || initialStatus || '';
  
  // Search query & pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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
        return student.lifecycle_status === 'active' || student.lifecycle_status === 'admitted';
      }
      return student.lifecycle_status === activeStatus;
    });
  }, [students, activeStatus]);

  // 2. Search Query Filter
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFiltered;

    return statusFiltered.filter((student) => {
      const name = (student.full_name ?? '').toLowerCase();
      const adm = (student.admission_number ?? '').toLowerCase();
      const progCode = (student.programme?.code ?? '').toLowerCase();
      const progName = (student.programme?.name ?? '').toLowerCase();
      const cohortName = (student.current_cohort?.name ?? '').toLowerCase();
      const cohortCode = (student.current_cohort?.code ?? '').toLowerCase();
      const statusLabel = getStudentStatusLabel(student.lifecycle_status, student.academic_phase).toLowerCase();
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
  }, [statusFiltered, searchQuery]);

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

      const cmp = valA.localeCompare(valB, 'en', { numeric: true, sensitivity: 'base' });
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
    router.push(`/students/registry${params.toString() ? `?${params.toString()}` : ''}`);
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
    { value: 'dropped_out', label: 'Dropped out', count: statusCounts.dropped_out },
    { value: 'completed', label: 'Completed', count: statusCounts.completed },
    { value: 'graduated', label: 'Graduated', count: statusCounts.graduated },
  ];

  return (
    <div className="space-y-4">
      {/* STATUS FILTER PILLS & SEARCH BAR TOOLBAR */}
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

        {/* Search Input Box */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="text"
            placeholder="Search students, admission no, cohort..."
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

      {/* REGISTRY DATA TABLE CARD */}
      {filteredStudents.length === 0 ? (
        <Card className="p-6 text-center">
          <EmptyState
            icon={Database}
            title={searchQuery ? 'No matching students found' : 'No students in this status'}
            description={
              searchQuery
                ? `No student record matches "${searchQuery}". Try searching by another name or admission number.`
                : 'No student records were found under the selected status filter.'
            }
            action={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
                >
                  Clear search filter
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
                Showing {sortedStudents.length} student{sortedStudents.length === 1 ? '' : 's'}
                {searchQuery ? ` matching "${searchQuery}"` : ''}
              </p>
            </div>
            {searchQuery ? (
              <Badge variant="neutral" className="text-xs">
                Filtered: {sortedStudents.length} of {statusFiltered.length}
              </Badge>
            ) : null}
          </div>

          {/* Desktop & Mobile Table View */}
          <div className="divide-y divide-border">
            {/* Desktop Column Titles with Sort Toggles */}
            <div className="hidden border-b border-border bg-surface px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3">
              <button
                type="button"
                onClick={() => toggleSort('name')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Student</span>
                {sortField === 'name' ? (
                  sortOrder === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('programme')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Programme</span>
                {sortField === 'programme' ? (
                  sortOrder === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('cohort')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Cohort</span>
                {sortField === 'cohort' ? (
                  sortOrder === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggleSort('status')}
                className="flex items-center gap-1 text-left font-bold hover:text-text-primary"
              >
                <span>Status / Stage</span>
                {sortField === 'status' ? (
                  sortOrder === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                ) : null}
              </button>
              <span aria-hidden="true" />
            </div>

            {/* Student Rows */}
            {paginatedStudents.map((student) => (
              <Link
                key={student.id}
                href={`/students/registry/${student.id}`}
                className="grid gap-2 px-4 py-3 text-xs transition hover:bg-surface-subtle/80 md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3"
              >
                <div>
                  <p className="font-bold text-text-primary">{student.full_name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">{student.admission_number}</p>
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    {student.programme?.code ?? 'Programme unavailable'}
                  </p>
                  {student.programme?.name ? (
                    <p className="mt-0.5 text-[10px] text-text-muted truncate max-w-48 sm:max-w-none">
                      {student.programme.name}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    {student.current_cohort?.name ?? 'Not assigned'}
                  </p>
                </div>
                <StudentStatusStage student={student} />
                <ChevronRight className="size-3.5 text-text-muted justify-self-end" />
              </Link>
            ))}
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
            onNextPage={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
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
