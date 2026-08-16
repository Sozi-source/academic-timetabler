'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  CalendarCheck2,
  CalendarX2,
  Pencil,
  RotateCcw,
  Users,
  UsersRound,
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
  setCohortStatusAction,
  setCohortTimetableAvailabilityAction,
} from './actions';
import {
  cohortStatusOptions,
  type Cohort,
  type CohortStatus,
} from './types';

function getStatusLabel(
  status: CohortStatus,
) {
  return (
    cohortStatusOptions.find(
      (option) => option.value === status,
    )?.label ?? status
  );
}

function getStatusVariant(
  status: CohortStatus,
):
  | 'success'
  | 'warning'
  | 'neutral'
  | 'info' {
  switch (status) {
    case 'active':
      return 'success';

    case 'planned':
      return 'info';

    case 'suspended':
      return 'warning';

    case 'completed':
    case 'archived':
    default:
      return 'neutral';
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    'en-KE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(
    new Date(`${value}T00:00:00`),
  );
}

const columns: ColumnDef<Cohort>[] = [
  {
    accessorKey: 'name',
    header: 'Cohort',
    cell: ({ row }) => (
      <div className="min-w-56">
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
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.name ?? '',
    header: 'Programme',
    cell: ({ row }) => (
      <div className="min-w-60">
        <p className="font-medium text-text-primary">
          {row.original.programme?.name ??
            'Programme unavailable'}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.programme?.code ??
            row.original.programmeId}
        </p>
      </div>
    ),
  },
  {
    id: 'dates',
    accessorFn: (row) =>
      row.intakeDate,
    header: 'Dates',
    cell: ({ row }) => (
      <div className="min-w-44 text-sm text-text-primary">
        <p>
          Intake: {formatDate(row.original.intakeDate)}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          Completion:{' '}
          {formatDate(
            row.original.expectedCompletionDate,
          )}
        </p>
      </div>
    ),
  },
  {
    id: 'progress',
    accessorFn: (row) =>
      row.currentAcademicPeriodNumber,
    header: 'Progress',
    cell: ({ row }) => (
      <div className="min-w-32">
        <p className="font-medium text-text-primary">
          Period{' '}
          {row.original.currentAcademicPeriodNumber}
        </p>

        {row.original.programme ? (
          <p className="mt-1 text-xs text-text-muted">
            of{' '}
            {
              row.original.programme
                .totalAcademicPeriods
            }
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'enrolment',
    accessorFn: (row) =>
      row.actualSize,
    header: 'Enrolment',
    cell: ({ row }) => (
      <div className="min-w-36">
        <p className="inline-flex items-center gap-2 font-medium text-text-primary">
          <Users
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
          {row.original.actualSize}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.plannedSize
            ? `Planned ${row.original.plannedSize}`
            : 'No planned limit'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={getStatusVariant(
          row.original.status,
        )}
        dot={row.original.status === 'active'}
      >
        {getStatusLabel(row.original.status)}
      </Badge>
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
    id: 'actions',
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => {
      const canToggleAvailability =
        row.original.status === 'planned' ||
        row.original.status === 'active';

      return (
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/timetable/cohorts/${row.original.id}/edit`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Pencil
              className="size-3.5"
              aria-hidden="true"
            />
            Edit
          </Link>

          {canToggleAvailability ? (
            <form
              action={
                setCohortTimetableAvailabilityAction
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

          <form action={setCohortStatusAction}>
            <input
              type="hidden"
              name="id"
              value={row.original.id}
            />

            <Select
              name="status"
              aria-label={`Change status for ${row.original.name}`}
              defaultValue={row.original.status}
              className="h-9 text-xs"
              onChange={(event) => {
                event.currentTarget.form?.requestSubmit();
              }}
            >
              {cohortStatusOptions.map(
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
          </form>
        </div>
      );
    },
  },
];

interface CohortTableProps {
  cohorts: Cohort[];
  programmeOptions: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

export function CohortTable({
  cohorts,
  programmeOptions,
}: CohortTableProps) {
  const [programmeId, setProgrammeId] =
    useState('all');

  const [status, setStatus] = useState<
    'all' | CohortStatus
  >('all');

  const [availability, setAvailability] =
    useState<
      'all' | 'available' | 'unavailable'
    >('all');

  const filteredCohorts = useMemo(
    () =>
      cohorts.filter((cohort) => {
        const matchesProgramme =
          programmeId === 'all' ||
          cohort.programmeId === programmeId;

        const matchesStatus =
          status === 'all' ||
          cohort.status === status;

        const matchesAvailability =
          availability === 'all' ||
          (availability === 'available'
            ? cohort.isTimetableAvailable
            : !cohort.isTimetableAvailable);

        return (
          matchesProgramme &&
          matchesStatus &&
          matchesAvailability
        );
      }),
    [
      cohorts,
      programmeId,
      status,
      availability,
    ],
  );

  const filtersActive =
    programmeId !== 'all' ||
    status !== 'all' ||
    availability !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredCohorts}
      getRowId={(row) => row.id}
      searchPlaceholder="Search cohort names, codes or programmes"
      emptyIcon={UsersRound}
      emptyTitle={
        filtersActive
          ? 'No matching cohorts'
          : 'No cohorts registered'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other cohorts.'
          : 'Create cohorts after registering the academic programmes they belong to.'
      }
      initialPageSize={20}
      toolbarFilters={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by programme"
            value={programmeId}
            onChange={(event) => {
              setProgrammeId(
                event.target.value,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All programmes
            </option>

            {programmeOptions.map(
              (programme) => (
                <option
                  key={programme.id}
                  value={programme.id}
                >
                  {programme.code} - {programme.name}
                </option>
              ),
            )}
          </Select>

          <Select
            aria-label="Filter by cohort status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as
                  | 'all'
                  | CohortStatus,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All statuses
            </option>

            {cohortStatusOptions.map(
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
            className="h-11"
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
                setProgrammeId('all');
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