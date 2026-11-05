'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  RotateCcw,
  UserX,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

import { compareAdmissionNumbers } from './admission-number-sort';
import {
  BatchActionDialogs,
  type BatchActionType,
} from './batch-action-dialogs';
import type { RegistryCohortOption } from './queries';
import {
  getStatusBadgeVariant,
  getStudentStageLabel,
  getStudentStatusLabel,
} from './student-status-stage';
import type { StudentRow } from './types';

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
  const searchParams = useSearchParams();

  // Active status tab state (seeded once from the URL; kept locally afterwards
  // so switching tabs never waits on a server round-trip)
  const [activeStatus, setActiveStatus] = useState(
    () => searchParams.get('status') || initialStatus || '',
  );
  const [cohortFilter, setCohortFilter] = useState(
    () => searchParams.get('cohortId') || '',
  );

  // Bulk action dialog state
  const [batchAction, setBatchAction] = useState<{
    type: BatchActionType;
    rows: StudentRow[];
  } | null>(null);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (activeStatus) {
        const status = student.lifecycle_status;
        const phase = student.academic_phase;
        if (activeStatus === 'in_class') {
          if (
            (status !== 'active' && status !== 'admitted') ||
            phase === 'attachment'
          ) {
            return false;
          }
        } else if (activeStatus === 'on_attachment') {
          if (
            (status !== 'active' && status !== 'admitted') ||
            phase !== 'attachment'
          ) {
            return false;
          }
        } else if (status !== activeStatus) {
          return false;
        }
      }

      if (cohortFilter) {
        const matchesCohort =
          student.current_cohort?.id === cohortFilter ||
          student.admission_cohort?.id === cohortFilter;
        if (!matchesCohort) {
          return false;
        }
      }

      return true;
    });
  }, [students, activeStatus, cohortFilter]);

  const syncUrlParams = (nextStatus: string, nextCohort: string) => {
    const params = new URLSearchParams(window.location.search);
    if (nextStatus) {
      params.set('status', nextStatus);
    } else {
      params.delete('status');
    }
    if (nextCohort) {
      params.set('cohortId', nextCohort);
    } else {
      params.delete('cohortId');
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      `/students/registry${qs ? `?${qs}` : ''}`,
    );
  };

  const handleTabChange = (value: string) => {
    setActiveStatus(value);
    syncUrlParams(value, cohortFilter);
  };

  const handleCohortChange = (value: string) => {
    setCohortFilter(value);
    syncUrlParams(activeStatus, value);
  };

  // Server-side Excel export URL reflecting active status and cohort filters
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (activeStatus) params.set('status', activeStatus);
    if (cohortFilter) params.set('cohortId', cohortFilter);
    const qs = params.toString();
    return `/api/students/export${qs ? `?${qs}` : ''}`;
  }, [activeStatus, cohortFilter]);

  const statusTabs = [
    { value: '', label: 'All', count: statusCounts.all },
    { value: 'in_class', label: 'In Class', count: statusCounts.in_class },
    {
      value: 'on_attachment',
      label: 'On Attachment',
      count: statusCounts.on_attachment,
    },
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

  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        accessorFn: (student) => student.full_name ?? '',
        size: 240,
        cell: ({ row }) => {
          const student = row.original;

          return (
            <div className="min-w-0">
              <Link
                href={`/students/registry/${student.id}`}
                className="block truncate text-xs font-semibold text-text-primary transition hover:text-primary hover:underline"
              >
                {student.full_name}
              </Link>
              {student.programme?.code ? (
                <p className="mt-0.5 truncate text-[10px] text-text-muted">
                  {student.programme.code}
                  {student.current_cohort?.name
                    ? ` · ${student.current_cohort.name}`
                    : ''}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'admission_number',
        header: 'Admission No.',
        accessorFn: (student) => student.admission_number ?? '',
        sortingFn: (rowA, rowB) =>
          compareAdmissionNumbers(
            rowA.original.admission_number ?? '',
            rowB.original.admission_number ?? '',
          ),
        size: 160,
        cell: ({ row }) => (
          <Link
            href={`/students/registry/${row.original.id}`}
            className="whitespace-nowrap font-mono text-[11px] text-text-secondary transition hover:text-primary"
          >
            {row.original.admission_number}
          </Link>
        ),
      },
      {
        id: 'cohort',
        header: 'Cohort',
        accessorFn: (student) =>
          student.current_cohort?.name ??
          student.admission_cohort?.name ??
          '',
        size: 150,
        cell: ({ getValue }) => (
          <span className="text-xs text-text-secondary">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'programme',
        header: 'Programme',
        accessorFn: (student) => student.programme?.code ?? '',
        size: 110,
        cell: ({ getValue }) => (
          <span className="text-xs font-semibold text-text-secondary">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (student) =>
          getStudentStatusLabel(
            student.lifecycle_status,
            student.academic_phase,
          ),
        size: 150,
        cell: ({ row, getValue }) => (
          <Badge
            variant={getStatusBadgeVariant(
              row.original.lifecycle_status,
              row.original.academic_phase,
            )}
          >
            {getValue<string>()}
          </Badge>
        ),
      },
      {
        id: 'stage',
        header: 'Stage',
        accessorFn: (student) => getStudentStageLabel(student),
        size: 90,
        cell: ({ getValue }) => (
          <span className="text-xs font-semibold text-text-secondary">
            {getValue<string>()}
          </span>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        accessorFn: (student) => student.phone_number ?? '',
        size: 130,
        cell: ({ getValue }) => (
          <span className="font-mono text-[11px] text-text-secondary">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        accessorFn: (student) => student.email ?? '',
        size: 200,
        cell: ({ getValue }) => (
          <span className="truncate text-xs text-text-secondary">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Link
              href={`/students/registry/${row.original.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              aria-label={`Open record for ${row.original.full_name}`}
            >
              <span>Record</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const filtersActive = Boolean(activeStatus || cohortFilter);

  return (
    <div className="space-y-3">
      {/* Status filter pills bar */}
      <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
        {/* Mobile dropdown */}
        <div className="flex items-center gap-2 sm:hidden">
          <UsersRound
            className="size-3.5 shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <Select
            aria-label="Filter by student lifecycle status"
            value={activeStatus}
            onChange={(event) => handleTabChange(event.target.value)}
            className="h-8 w-full text-xs"
          >
            {statusTabs.map((tab) => (
              <option key={tab.label} value={tab.value}>
                {tab.label} ({tab.count})
              </option>
            ))}
          </Select>
        </div>

        {/* Desktop pills */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
          {statusTabs.map((tab) => {
            const isActive = activeStatus === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-surface-subtle hover:text-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
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

      {batchFeedback ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-primary-soft px-3.5 py-2 text-xs font-semibold text-primary-deep"
        >
          <span>{batchFeedback}</span>
          <button
            type="button"
            onClick={() => setBatchFeedback(null)}
            className="inline-flex size-6 items-center justify-center rounded-md text-primary-deep hover:bg-surface/60"
            aria-label="Dismiss message"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filteredStudents}
        getRowId={(student) => student.id}
        searchPlaceholder="Search student name, admission no., cohort or stage..."
        emptyIcon={UsersRound}
        emptyTitle={
          filtersActive
            ? 'No matching students found'
            : 'No students registered'
        }
        emptyDescription={
          filtersActive
            ? 'No student record matches the active status or cohort filter.'
            : 'Import or register students to populate the departmental registry.'
        }
        initialPageSize={25}
        initialHiddenColumns={['programme', 'phone', 'email']}
        enableColumnToggle
        enableDensityToggle
        enableRowSelection
        exportFileName="student-registry"
        stickyHeader
        toolbarFilters={
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-1 md:justify-end">
            {cohorts.length > 0 ? (
              <Select
                aria-label="Filter by cohort"
                value={cohortFilter}
                onChange={(event) => handleCohortChange(event.target.value)}
                className="h-9 w-full text-xs sm:w-auto sm:min-w-44"
              >
                <option value="">All cohorts</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                    {cohort.programmeCode ? ` (${cohort.programmeCode})` : ''}
                  </option>
                ))}
              </Select>
            ) : null}

            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                }
                onClick={() => {
                  setActiveStatus('');
                  setCohortFilter('');
                  syncUrlParams('', '');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        }
        toolbarActions={
          <a
            href={exportUrl}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary shadow-sm transition hover:bg-surface-subtle hover:text-text-primary"
            title="Export filtered student list to Excel"
          >
            <Download className="size-4" aria-hidden="true" />
            <span>Excel</span>
          </a>
        }
        bulkActions={(selectedRows) => (
          <>
            <button
              type="button"
              onClick={() =>
                setBatchAction({
                  type: 'confirm_reported',
                  rows: selectedRows,
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-primary transition hover:bg-surface-subtle"
            >
              <CheckCircle2
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              <span>Confirm reported</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setBatchAction({
                  type: 'reassign_cohort',
                  rows: selectedRows,
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-primary transition hover:bg-surface-subtle"
            >
              <UsersRound
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              <span>Reassign cohort</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setBatchAction({
                  type: 'defer',
                  rows: selectedRows,
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Clock className="size-3.5" aria-hidden="true" />
              <span>Defer</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setBatchAction({
                  type: 'dropout',
                  rows: selectedRows,
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-danger transition hover:bg-danger-subtle"
            >
              <UserX className="size-3.5" aria-hidden="true" />
              <span>Mark dropped out</span>
            </button>
          </>
        )}
      />

      <BatchActionDialogs
        openAction={batchAction?.type ?? null}
        onClose={() => setBatchAction(null)}
        selectedStudents={batchAction?.rows ?? []}
        cohorts={cohorts}
        onSuccess={(message) => setBatchFeedback(message)}
      />
    </div>
  );
}
