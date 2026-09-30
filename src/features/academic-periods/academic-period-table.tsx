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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    size: 56,
    enableSorting: false,
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
      <p className="font-medium text-text-primary" title={row.original.code}>
        {row.original.name}
      </p>
    ),
  },
  {
    id: 'periodDates',
    accessorFn: (row) => `${row.startsOn} ${row.endsOn}`,
    header: 'Period dates',
    cell: ({ row }) => {
      const period = `${formatDate(row.original.startsOn)} – ${formatDate(row.original.endsOn)}`;
      const teaching = `${formatDate(row.original.teachingStartsOn)} – ${formatDate(row.original.teachingEndsOn)}`;
      const differs =
        row.original.teachingStartsOn !== row.original.startsOn ||
        row.original.teachingEndsOn !== row.original.endsOn;
      return (
        <div className="min-w-0">
          <p className="text-sm text-text-primary">{period}</p>
          {differs ? (
            <p className="mt-0.5 text-[11px] text-text-muted">Teaching: {teaching}</p>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    size: 100,
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
    size: 48,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              aria-label={`Actions for ${row.original.name}`}
              title="Actions"
            >
              <MoreVertical
                className="size-4"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-2">
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

            <div className="mt-1 border-t border-border pt-2">
              <AcademicPeriodLifecycleAction
                academicPeriod={row.original}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
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