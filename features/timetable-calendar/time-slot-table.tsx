'use client';

import type {
  ColumnDef,
} from '@tanstack/react-table';
import {
  CheckCircle2,
  CircleOff,
  Clock3,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

import {
  setTimeSlotEnabledAction,
} from './actions';
import type {
  TimeSlot,
  TimeSlotType,
} from './types';

const slotTypeLabels: Record<
  TimeSlotType,
  string
> = {
  teaching: 'Teaching',
  break: 'Break',
  lunch: 'Lunch',
  assembly: 'Assembly',
  other: 'Other',
};

function formatTime(value: string) {
  const [hours, minutes] =
    value.split(':').map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat(
    'en-KE',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    },
  ).format(date);
}

const columns: ColumnDef<TimeSlot>[] = [
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
    header: 'Time Slot',
    cell: ({ row }) => (
      <div className="min-w-0">
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
    accessorKey: 'slotType',
    header: 'Type',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.slotType === 'teaching'
            ? 'primary'
            : 'neutral'
        }
      >
        {slotTypeLabels[row.original.slotType]}
      </Badge>
    ),
  },
  {
    id: 'timeRange',
    accessorFn: (row) =>
      `${row.startsAt} ${row.endsAt}`,
    header: 'Time',
    cell: ({ row }) => (
      <span className="whitespace-normal break-words font-medium text-text-primary">
        {formatTime(row.original.startsAt)}
        {' to '}
        {formatTime(row.original.endsAt)}
      </span>
    ),
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.isEnabled
            ? 'success'
            : 'neutral'
        }
        dot={row.original.isEnabled}
      >
        {row.original.isEnabled
          ? 'Enabled'
          : 'Disabled'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => (
      <form
        action={setTimeSlotEnabledAction}
        className="flex justify-end"
      >
        <input
          type="hidden"
          name="id"
          value={row.original.id}
        />

        <input
          type="hidden"
          name="isEnabled"
          value={
            row.original.isEnabled
              ? 'false'
              : 'true'
          }
        />

        <Button
          type="submit"
          variant="outline"
          size="sm"
          leadingIcon={
            row.original.isEnabled ? (
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
          {row.original.isEnabled
            ? 'Disable'
            : 'Enable'}
        </Button>
      </form>
    ),
  },
];

interface TimeSlotTableProps {
  timeSlots: TimeSlot[];
}

export function TimeSlotTable({
  timeSlots,
}: TimeSlotTableProps) {
  return (
    <DataTable
      columns={columns}
      data={timeSlots}
      getRowId={(row) => row.id}
      searchPlaceholder="Search slots, codes or types"
      emptyIcon={Clock3}
      emptyTitle="No Time Slots configured"
      emptyDescription="Create teaching, break and lunch slots for the selected Academic Period."
      initialPageSize={20}
    />
  );
}