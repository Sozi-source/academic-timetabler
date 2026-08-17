'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  MoreVertical,
CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  GraduationCap,
  Pencil,
  RotateCcw,
  Timer,
  Users,
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
  setProgrammeActiveAction,
  setProgrammeTimetableAvailabilityAction,
} from './actions';
import {
  programmeAwardLevelOptions,
  type Programme,
  type ProgrammeAwardLevel,
} from './types';

function getAwardLevelLabel(
  awardLevel: ProgrammeAwardLevel,
) {
  return (
    programmeAwardLevelOptions.find(
      (option) =>
        option.value === awardLevel,
    )?.label ?? awardLevel
  );
}

function formatDuration(
  programme: Programme,
) {
  const value =
    Number.isInteger(programme.durationValue)
      ? String(programme.durationValue)
      : programme.durationValue.toFixed(1);

  const unit =
    programme.durationValue === 1
      ? programme.durationUnit === 'years'
        ? 'year'
        : 'month'
      : programme.durationUnit;

  return `${value} ${unit}`;
}

const columns: ColumnDef<Programme>[] = [
  {
    accessorKey: 'name',
    header: 'Programme',
    cell: ({ row }) => (
      <div className="min-w-64">
        <p className="font-semibold leading-5 text-text-primary [overflow-wrap:normal] break-normal">
          {row.original.name}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.code}
          {row.original.shortName
            ? ` · ${row.original.shortName}`
            : ''}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'awardLevel',
    header: 'Award',
    cell: ({ row }) => (
      <div className="min-w-40">
        <Badge variant="neutral">
          {getAwardLevelLabel(
            row.original.awardLevel,
          )}
        </Badge>

        {row.original.awardingBody ? (
          <p className="mt-2 text-xs text-text-muted">
            {row.original.awardingBody}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'duration',
    accessorFn: (row) =>
      row.durationValue,
    header: 'Duration',
    cell: ({ row }) => (
      <div className="min-w-36">
        <p className="inline-flex items-center gap-2 font-medium text-text-primary">
          <Timer
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
          {formatDuration(row.original)}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.totalAcademicPeriods}{' '}
          Academic Periods
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'maximumCohortSize',
    header: 'Cohort planning',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 font-medium text-text-primary">
        <Users
          className="size-4 text-text-muted"
          aria-hidden="true"
        />
        {row.original.maximumCohortSize
          ? `Up to ${row.original.maximumCohortSize}`
          : 'Not limited'}
      </span>
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
      <details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            aria-label={`Actions for ${row.original.name}`}
          >
            <MoreVertical
              className="size-4"
              aria-hidden="true"
            />
          </summary>

          <div className="absolute right-0 z-40 mt-1 min-w-[210px] rounded-xl border border-border bg-surface p-2 shadow-xl [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
        <Link
          href={`/timetable/programmes/${row.original.id}/edit`}
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
              setProgrammeTimetableAvailabilityAction
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

        <form action={setProgrammeActiveAction}>
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
        </details>
    ),
  },
];

interface ProgrammeTableProps {
  programmes: Programme[];
}

export function ProgrammeTable({
  programmes,
}: ProgrammeTableProps) {
  const [awardLevel, setAwardLevel] =
    useState<
      'all' | ProgrammeAwardLevel
    >('all');

  const [status, setStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const [availability, setAvailability] =
    useState<
      'all' | 'available' | 'unavailable'
    >('all');

  const filteredProgrammes = useMemo(
    () =>
      programmes.filter((programme) => {
        const matchesAwardLevel =
          awardLevel === 'all' ||
          programme.awardLevel ===
            awardLevel;

        const matchesStatus =
          status === 'all' ||
          (status === 'active'
            ? programme.isActive
            : !programme.isActive);

        const matchesAvailability =
          availability === 'all' ||
          (availability === 'available'
            ? programme.isTimetableAvailable
            : !programme.isTimetableAvailable);

        return (
          matchesAwardLevel &&
          matchesStatus &&
          matchesAvailability
        );
      }),
    [
      programmes,
      awardLevel,
      status,
      availability,
    ],
  );

  const filtersActive =
    awardLevel !== 'all' ||
    status !== 'all' ||
    availability !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredProgrammes}
      getRowId={(row) => row.id}
      searchPlaceholder="Search programme names, codes, awards or awarding bodies"
      emptyIcon={GraduationCap}
      emptyTitle={
        filtersActive
          ? 'No matching programmes'
          : 'No programmes registered'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other programmes.'
          : 'Register academic programmes before creating cohorts, curriculum units and teaching allocations.'
      }
      initialPageSize={20}
      toolbarFilters={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by award level"
            value={awardLevel}
            onChange={(event) => {
              setAwardLevel(
                event.target.value as
                  | 'all'
                  | ProgrammeAwardLevel,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All award levels
            </option>

            {programmeAwardLevelOptions.map(
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
            aria-label="Filter by programme status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as
                  | 'all'
                  | 'active'
                  | 'inactive',
              );
            }}
            className="h-11"
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
                setAwardLevel('all');
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