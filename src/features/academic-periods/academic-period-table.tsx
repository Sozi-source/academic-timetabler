'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  CalendarDays,
  MoreVertical,
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
      <div className="w-[190px] min-w-[190px] max-w-[220px]">
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
      <div className="w-[110px] min-w-[110px]">
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
    header: '',
    size: 52,
    minSize: 52,
    maxSize: 52,
    cell: ({ row }) => (
      <details className="relative">
        <summary
          className="inline-flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          aria-label={`Actions for ${row.original.name}`}
          title="Actions"
        >
          <MoreVertical
            className="size-4"
            aria-hidden="true"
          />
        </summary>

        <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <Link
            href={`/timetable/academic-periods/${row.original.id}/edit`}
            className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Pencil
              className="size-3.5"
              aria-hidden="true"
            />
            Edit Academic Period
          </Link>

          <div className="mt-1 border-t border-border pt-2 [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
            <AcademicPeriodLifecycleAction
              academicPeriod={row.original}
            />
          </div>
        </div>
      </details>
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
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap lg:items-center">
          <Select
            aria-label="Filter by Academic Year"
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(
                event.target.value,
              );
            }}
            className="h-10 w-full lg:w-56"
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
            className="h-10 w-full lg:w-44"
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