'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  CalendarDays,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import {
  useMemo,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

import {
  AcademicPeriodLifecycleAction,
} from './academic-period-lifecycle-action';
import {
  AcademicPeriodStatusBadge,
} from './academic-period-status-badge';
import type {
  AcademicPeriod,
  AcademicPeriodStatus,
} from './types';

const dateFormatter = new Intl.DateTimeFormat(
  'en-GB',
  {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  },
);

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

const columns: ColumnDef<AcademicPeriod>[] = [
  {
    accessorKey: 'sequenceNumber',
    header: 'Order',
    cell: ({ row }) => (
      <span className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface-subtle text-xs font-semibold text-text-secondary">
        {row.original.sequenceNumber}
      </span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Academic Period',
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="font-semibold text-text-primary">
          {row.original.name}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.code}
        </p>
      </div>
    ),
  },
  {
    id: 'academicYear',
    accessorFn: (row) =>
      row.academicYear.name,
    header: 'Academic Year',
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium text-text-primary">
          {row.original.academicYear.name}
        </p>

        <p className="mt-1 text-xs capitalize text-text-muted">
          {row.original.academicYear.status}
        </p>
      </div>
    ),
  },
  {
    id: 'periodDates',
    accessorFn: (row) =>
      `${row.startsOn} ${row.endsOn}`,
    header: 'Period dates',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.startsOn)}
        {' to '}
        {formatDate(row.original.endsOn)}
      </span>
    ),
  },
  {
    id: 'teachingDates',
    accessorFn: (row) =>
      `${row.teachingStartsOn} ${row.teachingEndsOn}`,
    header: 'Teaching window',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(
          row.original.teachingStartsOn,
        )}
        {' to '}
        {formatDate(
          row.original.teachingEndsOn,
        )}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <AcademicPeriodStatusBadge
        status={row.original.status}
      />
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/timetable/academic-periods/${row.original.id}/edit`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <Pencil
            className="size-3.5"
            aria-hidden="true"
          />
          Edit
        </Link>

        <AcademicPeriodLifecycleAction
          academicPeriod={row.original}
        />
      </div>
    ),
  },
];

interface AcademicPeriodTableProps {
  academicPeriods: AcademicPeriod[];
}

export function AcademicPeriodTable({
  academicPeriods,
}: AcademicPeriodTableProps) {
  const [academicYearId, setAcademicYearId] =
    useState('all');

  const [status, setStatus] =
    useState<'all' | AcademicPeriodStatus>(
      'all',
    );

  const academicYears = useMemo(() => {
    const years = new Map<string, string>();

    academicPeriods.forEach((period) => {
      years.set(
        period.academicYearId,
        period.academicYear.name,
      );
    });

    return Array.from(years.entries())
      .map(([id, name]) => ({
        id,
        name,
      }))
      .sort((a, b) =>
        b.name.localeCompare(a.name),
      );
  }, [academicPeriods]);

  const filteredPeriods = useMemo(
    () =>
      academicPeriods.filter((period) => {
        const matchesYear =
          academicYearId === 'all' ||
          period.academicYearId ===
            academicYearId;

        const matchesStatus =
          status === 'all' ||
          period.status === status;

        return matchesYear && matchesStatus;
      }),
    [
      academicPeriods,
      academicYearId,
      status,
    ],
  );

  const filtersActive =
    academicYearId !== 'all' ||
    status !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredPeriods}
      getRowId={(row) => row.id}
      searchPlaceholder="Search periods, codes or Academic Years"
      emptyIcon={CalendarDays}
      emptyTitle={
        filtersActive
          ? 'No matching Academic Periods'
          : 'No Academic Periods created'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other Academic Periods.'
          : 'Create the first Academic Period to define the teaching and timetable calendar.'
      }
      initialPageSize={10}
      toolbarFilters={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by Academic Year"
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(
                event.target.value,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All Academic Years
            </option>

            {academicYears.map(
              (academicYear) => (
                <option
                  key={academicYear.id}
                  value={academicYear.id}
                >
                  {academicYear.name}
                </option>
              ),
            )}
          </Select>

          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as
                  | 'all'
                  | AcademicPeriodStatus,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All statuses
            </option>
            <option value="planned">
              Planned
            </option>
            <option value="active">
              Active
            </option>
            <option value="closed">
              Closed
            </option>
            <option value="archived">
              Archived
            </option>
          </Select>

          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={
                <RotateCcw
                  className="size-3.5"
                  aria-hidden="true"
                />
              }
              onClick={() => {
                setAcademicYearId('all');
                setStatus('all');
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      }
    />
  );
}