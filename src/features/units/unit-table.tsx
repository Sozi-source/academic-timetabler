'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  MoreVertical,
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
    return 'None';
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
    size: 220,
    minSize: 190,
    maxSize: 240,
    cell: ({ row }) => (
      <div className="w-[220px] min-w-[190px] max-w-[240px] pr-3">
        <p className="max-w-[220px] whitespace-normal break-words font-semibold leading-5 text-text-primary">
          {row.original.name}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-text-muted">
          {row.original.code}
          {row.original.shortName
            ? ` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${row.original.shortName}`
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
    size: 92,
    minSize: 84,
    maxSize: 104,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm font-semibold text-text-primary">
        {row.original.programme?.code ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    size: 96,
    minSize: 88,
    maxSize: 108,
    cell: ({ row }) => (
      <Badge variant="neutral">
        {getCategoryLabel(row.original.category)}
      </Badge>
    ),
  },
  {
    accessorKey: 'academicPeriodNumber',
    header: 'Period',
    size: 88,
    minSize: 82,
    maxSize: 96,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm font-medium text-text-primary">
        Period {row.original.academicPeriodNumber}
      </span>
    ),
  },
  {
    header: 'Contact hours',
    size: 108,
    minSize: 96,
    maxSize: 118,
    cell: ({ row }) => {
      const hours =
        row.original.theoryHours +
        row.original.practicalHours;

      return (
        <span className="whitespace-nowrap text-sm font-medium text-text-primary">
          {hours} {hours === 1 ? 'hr' : 'hrs'}
        </span>
      );
    },
  },
  {
    id: 'availability',
    accessorFn: (row) =>
      row.isTimetableAvailable
        ? 'available'
        : 'unavailable',
    header: 'Timetable',
    size: 118,
    minSize: 108,
    maxSize: 128,
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
    size: 96,
    minSize: 88,
    maxSize: 108,
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
    header: '',
    size: 52,
    minSize: 52,
    maxSize: 52,
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

          <div className="absolute right-0 z-40 mt-1 min-w-[190px] rounded-xl border border-border bg-surface p-2 shadow-xl [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
        <Link
          href={`/timetable/units/${row.original.id}/edit`}
          className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
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
        </details>
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
      searchPlaceholder="Search unit names, codes, programmes or categories..."
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
      initialPageSize={10}
      toolbarFilters={
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-1 lg:flex-nowrap">
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
            className="h-10 w-full sm:w-auto lg:w-40"
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