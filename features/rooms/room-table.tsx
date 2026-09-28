'use client';

import type { ColumnDef } from '@tanstack/react-table';
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
import { useMemo, useState } from 'react';

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

function getRoomTypeLabel(roomType: RoomType) {
  return roomTypeOptions.find((option) => option.value === roomType)?.label ?? roomType;
}

const columns: ColumnDef<Room>[] = [
  {
    accessorKey: 'code',
    header: 'Room',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-text-primary xl:text-sm">
          {row.original.code}
          {row.original.name && row.original.name !== row.original.code
            ? ` · ${row.original.name}`
            : ''}
        </p>
        {(row.original.building || row.original.floorLabel) ? (
          <p className="mt-0.5 text-[10px] text-text-muted xl:text-xs">
            {[row.original.building, row.original.floorLabel].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'roomType',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="neutral">{getRoomTypeLabel(row.original.roomType)}</Badge>
    ),
  },
  {
    accessorKey: 'capacity',
    header: 'Capacity',
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-primary xl:text-sm">
          <Users className="size-3.5 text-text-muted" aria-hidden="true" />
          {row.original.capacity}
        </span>
        {row.original.isAccessible ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-text-muted xl:text-xs">
            <Accessibility className="size-3" aria-hidden="true" />
            Accessible
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'availability',
    accessorFn: (row) =>
      !row.isActive ? 'inactive' : row.isTimetableAvailable ? 'available' : 'unavailable',
    header: 'Availability',
    cell: ({ row }) => {
      if (!row.original.isActive) {
        return <Badge variant="warning">Inactive</Badge>;
      }

      return (
        <Badge
          variant={row.original.isTimetableAvailable ? 'success' : 'neutral'}
          dot={row.original.isTimetableAvailable}
        >
          {row.original.isTimetableAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/timetable/rooms/${row.original.id}/edit`}
          aria-label={`Edit ${row.original.code}`}
          title="Edit"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </Link>

        {row.original.isActive ? (
          <form action={setRoomTimetableAvailabilityAction}>
            <input type="hidden" name="id" value={row.original.id} />
            <input
              type="hidden"
              name="isTimetableAvailable"
              value={row.original.isTimetableAvailable ? 'false' : 'true'}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={row.original.isTimetableAvailable ? 'Remove from timetable' : 'Make available'}
              title={row.original.isTimetableAvailable ? 'Remove from timetable' : 'Make available'}
            >
              {row.original.isTimetableAvailable ? (
                <CalendarX2 className="size-3.5" aria-hidden="true" />
              ) : (
                <CalendarCheck2 className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          </form>
        ) : null}

        <form action={setRoomActiveAction}>
          <input type="hidden" name="id" value={row.original.id} />
          <input type="hidden" name="isActive" value={row.original.isActive ? 'false' : 'true'} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={row.original.isActive ? 'Deactivate room' : 'Activate room'}
            title={row.original.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.original.isActive ? (
              <CircleOff className="size-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </form>
      </div>
    ),
  },
];

interface RoomTableProps {
  rooms: Room[];
}

type RoomState = 'all' | 'available' | 'unavailable' | 'inactive';

export function RoomTable({ rooms }: RoomTableProps) {
  const [roomType, setRoomType] = useState<'all' | RoomType>('all');
  const [state, setState] = useState<RoomState>('all');

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const matchesType = roomType === 'all' || room.roomType === roomType;
        const matchesState =
          state === 'all' ||
          (state === 'available' && room.isActive && room.isTimetableAvailable) ||
          (state === 'unavailable' && room.isActive && !room.isTimetableAvailable) ||
          (state === 'inactive' && !room.isActive);

        return matchesType && matchesState;
      }),
    [roomType, rooms, state],
  );

  const filtersActive = roomType !== 'all' || state !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredRooms}
      getRowId={(row) => row.id}
      searchPlaceholder="Search rooms"
      emptyIcon={Building2}
      emptyTitle={filtersActive ? 'No matching rooms' : 'No rooms registered'}
      emptyDescription={filtersActive ? 'Adjust or clear the filters.' : 'Add a room to begin.'}
      initialPageSize={20}
      toolbarFilters={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by room type"
            value={roomType}
            onChange={(event) => setRoomType(event.target.value as 'all' | RoomType)}
            className="h-9 w-40 text-[12px] xl:text-sm"
          >
            <option value="all">All types</option>
            {roomTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>

          <Select
            aria-label="Filter by room state"
            value={state}
            onChange={(event) => setState(event.target.value as RoomState)}
            className="h-9 w-40 text-[12px] xl:text-sm"
          >
            <option value="all">All states</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="inactive">Inactive</option>
          </Select>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
              onClick={() => {
                setRoomType('all');
                setState('all');
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
