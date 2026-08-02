'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  Clock3,
  Mail,
  Pencil,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import {
  useMemo,
  useState,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

import {
  setTrainerActiveAction,
  setTrainerTimetableAvailabilityAction,
} from './actions';
import {
  trainerEmploymentTypeOptions,
  type Trainer,
  type TrainerEmploymentType,
} from './types';

function getEmploymentTypeLabel(
  employmentType: TrainerEmploymentType,
) {
  return (
    trainerEmploymentTypeOptions.find(
      (option) =>
        option.value === employmentType,
    )?.label ?? employmentType
  );
}

const columns: ColumnDef<Trainer>[] = [
  {
    accessorKey: 'fullName',
    header: 'Trainer',
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="font-semibold text-text-primary">
          {row.original.fullName}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.staffNumber}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'employmentType',
    header: 'Employment',
    cell: ({ row }) => (
      <Badge variant="neutral">
        {getEmploymentTypeLabel(
          row.original.employmentType,
        )}
      </Badge>
    ),
  },
  {
    id: 'specialization',
    accessorFn: (row) =>
      row.specialization ?? '',
    header: 'Specialization',
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="text-sm text-text-primary">
          {row.original.specialization ??
            'Not specified'}
        </p>

        {row.original.email ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-text-muted">
            <Mail
              className="size-3.5"
              aria-hidden="true"
            />
            {row.original.email}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'workload',
    accessorFn: (row) =>
      row.maximumWeeklyHours,
    header: 'Teaching load',
    cell: ({ row }) => (
      <div className="min-w-36">
        <p className="inline-flex items-center gap-2 font-medium text-text-primary">
          <Clock3
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
          {row.original.maximumWeeklyHours} hrs/week
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.maximumDailyHours} hrs/day
        </p>
      </div>
    ),
  },
  {
    id: 'availability',
    accessorFn: (row) =>
      row.isTimetableAvailable
        ? 'available'
        : 'unavailable',
    header: 'Timetable',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.isTimetableAvailable
            ? 'success'
            : 'neutral'
        }
        dot={
          row.original.isTimetableAvailable
        }
      >
        {row.original.isTimetableAvailable
          ? 'Available'
          : 'Unavailable'}
      </Badge>
    ),
  },
  {
    id: 'status',
    accessorFn: (row) =>
      row.isActive
        ? 'active'
        : 'inactive',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.isActive
            ? 'success'
            : 'warning'
        }
        dot={row.original.isActive}
      >
        {row.original.isActive
          ? 'Active'
          : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex min-w-max flex-wrap justify-end gap-2">
        <Link
          href={`/timetable/trainers/${row.original.id}/edit`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <Pencil
            className="size-3.5"
            aria-hidden="true"
          />
          Edit
        </Link>

        {row.original.isActive ? (
          <form
            action={
              setTrainerTimetableAvailabilityAction
            }
          >
            <input
              type="hidden"
              name="id"
              value={row.original.id}
            />

            <input
              type="hidden"
              name="isTimetableAvailable"
              value={
                row.original.isTimetableAvailable
                  ? 'false'
                  : 'true'
              }
            />

            <Button
              type="submit"
              variant="outline"
              size="sm"
              leadingIcon={
                row.original.isTimetableAvailable ? (
                  <CalendarX2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                ) : (
                  <CalendarCheck2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )
              }
            >
              {row.original.isTimetableAvailable
                ? 'Remove availability'
                : 'Make available'}
            </Button>
          </form>
        ) : null}

        <form action={setTrainerActiveAction}>
          <input
            type="hidden"
            name="id"
            value={row.original.id}
          />

          <input
            type="hidden"
            name="isActive"
            value={
              row.original.isActive
                ? 'false'
                : 'true'
            }
          />

          <Button
            type="submit"
            variant={
              row.original.isActive
                ? 'ghost'
                : 'outline'
            }
            size="sm"
            leadingIcon={
              row.original.isActive ? (
                <CircleOff
                  className="size-3.5"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="size-3.5"
                  aria-hidden="true"
                />
              )
            }
          >
            {row.original.isActive
              ? 'Deactivate'
              : 'Activate'}
          </Button>
        </form>
      </div>
    ),
  },
];

interface TrainerTableProps {
  trainers: Trainer[];
}

export function TrainerTable({
  trainers,
}: TrainerTableProps) {
  const [
    employmentType,
    setEmploymentType,
  ] = useState<
    'all' | TrainerEmploymentType
  >('all');

  const [status, setStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const [availability, setAvailability] =
    useState<
      'all' | 'available' | 'unavailable'
    >('all');

  const filteredTrainers = useMemo(
    () =>
      trainers.filter((trainer) => {
        const matchesEmployment =
          employmentType === 'all' ||
          trainer.employmentType ===
            employmentType;

        const matchesStatus =
          status === 'all' ||
          (status === 'active'
            ? trainer.isActive
            : !trainer.isActive);

        const matchesAvailability =
          availability === 'all' ||
          (availability === 'available'
            ? trainer.isTimetableAvailable
            : !trainer.isTimetableAvailable);

        return (
          matchesEmployment &&
          matchesStatus &&
          matchesAvailability
        );
      }),
    [
      trainers,
      employmentType,
      status,
      availability,
    ],
  );

  const filtersActive =
    employmentType !== 'all' ||
    status !== 'all' ||
    availability !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredTrainers}
      getRowId={(row) => row.id}
      searchPlaceholder="Search names, staff numbers, emails or specializations"
      emptyIcon={UserRound}
      emptyTitle={
        filtersActive
          ? 'No matching trainers'
          : 'No trainers registered'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other trainers.'
          : 'Register teaching staff before creating unit allocations and timetables.'
      }
      initialPageSize={20}
      toolbarFilters={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by employment type"
            value={employmentType}
            onChange={(event) => {
              setEmploymentType(
                event.target.value as
                  | 'all'
                  | TrainerEmploymentType,
              );
            }}
            className="h-11 min-w-44"
          >
            <option value="all">
              All employment types
            </option>

            {trainerEmploymentTypeOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </Select>

          <Select
            aria-label="Filter by trainer status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as
                  | 'all'
                  | 'active'
                  | 'inactive',
              );
            }}
            className="h-11 min-w-36"
          >
            <option value="all">
              All statuses
            </option>
            <option value="active">
              Active
            </option>
            <option value="inactive">
              Inactive
            </option>
          </Select>

          <Select
            aria-label="Filter by timetable availability"
            value={availability}
            onChange={(event) => {
              setAvailability(
                event.target.value as
                  | 'all'
                  | 'available'
                  | 'unavailable',
              );
            }}
            className="h-11 min-w-44"
          >
            <option value="all">
              All availability
            </option>
            <option value="available">
              Timetable available
            </option>
            <option value="unavailable">
              Not timetable available
            </option>
          </Select>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={
                <RotateCcw
                  className="size-3.5"
                  aria-hidden="true"
                />
              }
              onClick={() => {
                setEmploymentType('all');
                setStatus('all');
                setAvailability('all');
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