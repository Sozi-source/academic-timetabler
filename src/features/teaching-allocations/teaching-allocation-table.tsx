import { BookOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  TeachingAllocation,
  TeachingAllocationStatus,
  TeachingDeliveryMode,
} from './types';

interface TeachingAllocationTableProps {
  allocations: TeachingAllocation[];
}

function getStatusVariant(
  status: TeachingAllocationStatus,
):
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral' {
  switch (status) {
    case 'active':
      return 'success';

    case 'draft':
      return 'warning';

    case 'suspended':
      return 'danger';

    case 'completed':
    case 'archived':
    default:
      return 'neutral';
  }
}

function getStatusLabel(
  status: TeachingAllocationStatus,
) {
  return status.charAt(0).toUpperCase() +
    status.slice(1);
}

function getDeliveryModeLabel(
  mode: TeachingDeliveryMode,
) {
  const labels: Record<
    TeachingDeliveryMode,
    string
  > = {
    theory: 'Theory',
    practical: 'Practical',
    clinical: 'Clinical',
    blended: 'Blended',
    project: 'Project',
    other: 'Other',
  };

  return labels[mode];
}

function formatWeeklyHours(
  allocation: TeachingAllocation,
) {
  const totalMinutes =
    allocation.weeklySessions *
    allocation.sessionDurationMinutes;

  const totalHours = totalMinutes / 60;

  return Number.isInteger(totalHours)
    ? `${totalHours} hrs/wk`
    : `${totalHours.toFixed(1)} hrs/wk`;
}

export function TeachingAllocationTable({
  allocations,
}: TeachingAllocationTableProps) {
  if (allocations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BookOpen
            className="size-6"
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-4 font-semibold text-text-primary">
          No teaching allocations yet
        </h2>
      </div>
    );
  }

  return (
    <TableContainer label="Teaching allocations">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Unit</TableHead>
            <TableHead>Cohort</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Load</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {allocations.map((allocation) => (
            <TableRow key={allocation.id}>
              <TableCell
                className="font-semibold text-text-primary"
                title={allocation.unit?.code ?? undefined}
              >
                {allocation.unit?.name ?? 'Unknown unit'}
              </TableCell>

              <TableCell className="text-text-secondary">
                {allocation.cohort?.name ?? 'Unknown cohort'}
              </TableCell>

              <TableCell className="text-text-primary">
                {allocation.trainer?.fullName ?? 'Unassigned'}
              </TableCell>

              <TableCell>
                <Badge variant="neutral">
                  {getDeliveryModeLabel(allocation.deliveryMode)}
                </Badge>
              </TableCell>

              <TableCell className="text-text-secondary">
                {formatWeeklyHours(allocation)} · {allocation.weeklySessions}×{allocation.sessionDurationMinutes}m
              </TableCell>

              <TableCell className="text-text-secondary">
                {allocation.preferredRoom?.name ?? 'Auto'}
              </TableCell>

              <TableCell>
                <div className="inline-flex items-center gap-1.5">
                  <Badge variant={getStatusVariant(allocation.status)}>
                    {getStatusLabel(allocation.status)}
                  </Badge>
                  {!allocation.isTimetableEnabled ? (
                    <Badge variant="neutral">Disabled</Badge>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
