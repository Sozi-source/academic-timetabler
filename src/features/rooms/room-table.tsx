'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  Accessibility,
  Building2,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  Pencil,
  RotateCcw,
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
  setRoomActiveAction,
  setRoomTimetableAvailabilityAction,
} from './actions';
import {
  roomTypeOptions,
  type Room,
  type RoomType,
} from './types';

function getRoomTypeLabel(
  roomType: RoomType,
) {
  return (
    roomTypeOptions.find(
      (option) =>
        option.value === roomType,
    )?.label ?? roomType
  );
}

const columns: ColumnDef<Room>[] = [
  {
    accessorKey: 'code',
    header: 'Room',
    cell: ({ row }) => (
      <div className="min-w-48">
        <p className="font-semibold text-text-primary">
          {row.original.code}
        </p>

        <p className="mt-1 text-xs text-text-muted">
          {row.original.name}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'roomType',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="neutral">
        {getRoomTypeLabel(
          row.original.roomType,
        )}
      </Badge>
    ),
  },
  {
    id: 'location',
    accessorFn: (row) =>
      `${row.building ?? ''} ${row.floorLabel ?? ''}`,
    header: 'Location',
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium text-text-primary">
          {row.original.building ??
            'Not specified'}
        </p>

        {row.original.floorLabel ? (
          <p className="mt-1 text-xs text-text-muted">
            {row.original.floorLabel}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'capacity',
    header: 'Capacity',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 font-medium text-text-primary">
        <Users
          className="size-4 text-text-muted"
          aria-hidden="true"
        />
        {row.original.capacity}
      </span>
    ),
  },
  {
    id: 'facilities',
    enableSorting: false,
    header: 'Facilities',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        {row.original.isAccessible ? (
          <Badge variant="info">
            <Accessibility
              className="mr-1 size-3.5"
              aria-hidden="true"
            />
            Accessible
          </Badge>
        ) : (
          <span className="text-xs text-text-muted">
            Standard access
          </span>
        )}
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
          href={`/timetable/rooms/${row.original.id}/edit`}
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
              setRoomTimetableAvailabilityAction
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
                ? 'Remove from timetable'
                : 'Make available'}
            </Button>
          </form>
        ) : null}

        <form action={setRoomActiveAction}>
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

interface RoomTableProps {
  rooms: Room[];
}

export function RoomTable({
  rooms,
}: RoomTableProps) {
  const [roomType, setRoomType] =
    useState<'all' | RoomType>('all');

  const [status, setStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const [availability, setAvailability] =
    useState<
      'all' | 'available' | 'unavailable'
    >('all');

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const matchesType =
          roomType === 'all' ||
          room.roomType === roomType;

        const matchesStatus =
          status === 'all' ||
          (status === 'active'
            ? room.isActive
            : !room.isActive);

        const matchesAvailability =
          availability === 'all' ||
          (availability === 'available'
            ? room.isTimetableAvailable
            : !room.isTimetableAvailable);

        return (
          matchesType &&
          matchesStatus &&
          matchesAvailability
        );
      }),
    [
      rooms,
      roomType,
      status,
      availability,
    ],
  );

  const filtersActive =
    roomType !== 'all' ||
    status !== 'all' ||
    availability !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredRooms}
      getRowId={(row) => row.id}
      searchPlaceholder="Search room codes, names, buildings or floors"
      emptyIcon={Building2}
      emptyTitle={
        filtersActive
          ? 'No matching rooms'
          : 'No rooms registered'
      }
      emptyDescription={
        filtersActive
          ? 'Adjust or clear the filters to view other rooms.'
          : 'Register the teaching rooms and specialist spaces used for timetable scheduling.'
      }
      initialPageSize={20}
      toolbarFilters={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by room type"
            value={roomType}
            onChange={(event) => {
              setRoomType(
                event.target.value as
                  | 'all'
                  | RoomType,
              );
            }}
            className="h-11 min-w-44"
          >
            <option value="all">
              All room types
            </option>

            {roomTypeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by room status"
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
                setRoomType('all');
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