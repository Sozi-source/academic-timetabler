'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  BookOpen,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  Clock3,
  DoorOpen,
  FlaskConical,
  Pencil,
  RotateCcw,
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
  roomTypeOptions,
  type RoomType,
} from '@/features/rooms/types';

import {
  setUnitActiveAction,
  setUnitTimetableAvailabilityAction,
} from './actions';
import {
  unitCategoryOptions,
  type Unit,
  type UnitCategory,
} from './types';

function getCategoryLabel(
  category: UnitCategory,
) {
  return (
    unitCategoryOptions.find(
      (option) =>
        option.value === category,
    )?.label ?? category
  );
}

function getRoomTypeLabel(
  roomType: RoomType | null,
) {
  if (!roomType) {
    return 'No preference';
  }

  return (
    roomTypeOptions.find(
      (option) =>
        option.value === roomType,
    )?.label ?? roomType
  );
}

const columns: ColumnDef<Unit>[] = [
  {
    accessorKey: 'name',
    header: 'Unit',
    size: 280,
    minSize: 230,
    cell: ({ row }) => (
      <div className="min-w-0 pr-5">
        <p className="font-semibold text-text-primary">
          {row.original.name}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-text-muted">
          {row.original.code}
          {row.original.shortName
            ? ` Â· ${row.original.shortName}`
            : ''}
        </p>
      </div>
    ),
  },
  {
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    size: 90,
    minSize: 80,
    maxSize: 105,
    cell: ({ row }) => (
      <span
        className="whitespace-nowrap font-semibold text-text-primary"
        title={
          row.original.programme?.name ??
          'Programme unavailable'
        }
      >
        {row.original.programme?.code ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    size: 95,
    cell: ({ row }) => (
      <Badge variant="neutral">
        {getCategoryLabel(
          row.original.category,
        )}
      </Badge>
    ),
  },
  {
    accessorKey: 'academicPeriodNumber',
    header: 'Period',
    size: 90,
    cell: ({ row }) => (
      <span className="font-medium text-text-primary">
        Period{' '}
        {row.original.academicPeriodNumber}
      </span>
    ),
  },
  {
    id: 'hours',
    accessorFn: (row) =>
      row.theoryHours + row.practicalHours,
    header: 'Contact hours',
    size: 130,
    minSize: 115,
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="inline-flex items-center gap-2 font-medium text-text-primary">
          <Clock3
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
          {row.original.theoryHours +
            row.original.practicalHours}{' '}
          total
        </p>

        <p className="mt-1 text-[10px] leading-4 text-text-muted">
          Theory {row.original.theoryHours}
          {' Â· '}
          Practical {row.original.practicalHours}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-text-muted">
          {row.original.weeklySessions}{' '}
          session
          {row.original.weeklySessions === 1
            ? ''
            : 's'}
          /week
        </p>
      </div>
    ),
  },
  {
    id: 'roomPreference',
    accessorFn: (row) =>
      row.preferredRoomType ?? '',
    header: 'Room preference',
    size: 125,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 text-sm text-text-primary">
        {row.original.practicalHours > 0 ? (
          <FlaskConical
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
        ) : (
          <DoorOpen
            className="size-4 text-text-muted"
            aria-hidden="true"
          />
        )}

        {getRoomTypeLabel(
          row.original.preferredRoomType,
        )}
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
    size: 95,
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
    size: 85,
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
    size: 105,
    minSize: 95,
    cell: ({ row }) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/timetable/units/${row.original.id}/edit`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
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
              setUnitTimetableAvailabilityAction
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
                ? 'Unavailable'
                : 'Available'}
            </Button>
          </form>
        ) : null}

        <form action={setUnitActiveAction}>
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

interface UnitTableProps {
  units: Unit[];
  programmeOptions: Array<{
    id: string;
    code: string;
    name: string;
    totalAcademicPeriods: number;
  }>;
}

export function UnitTable({
  units,
  programmeOptions,
}: UnitTableProps) {
  const [programmeId, setProgrammeId] =
    useState('all');

  const [periodNumber, setPeriodNumber] =
    useState('all');

  const [category, setCategory] =
    useState<'all' | UnitCategory>('all');

  const [status, setStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const [availability, setAvailability] =
    useState<
      'all' | 'available' | 'unavailable'
    >('all');

  const periodOptions = useMemo(() => {
    const values = new Set(
      units
        .filter(
          (unit) =>
            programmeId === 'all' ||
            unit.programmeId === programmeId,
        )
        .map(
          (unit) =>
            unit.academicPeriodNumber,
        ),
    );

    return Array.from(values).sort(
      (a, b) => a - b,
    );
  }, [units, programmeId]);

  const filteredUnits = useMemo(
    () =>
      units.filter((unit) => {
        const matchesProgramme =
          programmeId === 'all' ||
          unit.programmeId === programmeId;

        const matchesPeriod =
          periodNumber === 'all' ||
          unit.academicPeriodNumber ===
            Number(periodNumber);

        const matchesCategory =
          category === 'all' ||
          unit.category === category;

        const matchesStatus =
          status === 'all' ||
          (status === 'active'
            ? unit.isActive
            : !unit.isActive);

        const matchesAvailability =
          availability === 'all' ||
          (availability === 'available'
            ? unit.isTimetableAvailable
            : !unit.isTimetableAvailable);

        return (
          matchesProgramme &&
          matchesPeriod &&
          matchesCategory &&
          matchesStatus &&
          matchesAvailability
        );
      }),
    [
      units,
      programmeId,
      periodNumber,
      category,
      status,
      availability,
    ],
  );

  const filtersActive =
    programmeId !== 'all' ||
    periodNumber !== 'all' ||
    category !== 'all' ||
    status !== 'all' ||
    availability !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredUnits}
      getRowId={(row) => row.id}
      searchPlaceholder="Search unit names, codes, programmes or room preferences"
      emptyIcon={BookOpen}
      emptyTitle={
        filtersActive
          ? 'No matching units'
          : 'No units registered'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other curriculum units.'
          : 'Register curriculum units before creating teaching allocations.'
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
              setPeriodNumber('all');
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
            aria-label="Filter by Academic Period"
            value={periodNumber}
            onChange={(event) => {
              setPeriodNumber(
                event.target.value,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All periods
            </option>

            {periodOptions.map((period) => (
              <option
                key={period}
                value={period}
              >
                Period {period}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by unit category"
            value={category}
            onChange={(event) => {
              setCategory(
                event.target.value as
                  | 'all'
                  | UnitCategory,
              );
            }}
            className="h-11"
          >
            <option value="all">
              All categories
            </option>

            {unitCategoryOptions.map(
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
            aria-label="Filter by unit status"
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
                setProgrammeId('all');
                setPeriodNumber('all');
                setCategory('all');
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