import {
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  UserRound,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

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
    ? `${totalHours} hrs/week`
    : `${totalHours.toFixed(1)} hrs/week`;
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

        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-muted">
          Import allocations from the standardized
          workbook or register them individually before
          generating a timetable.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-text-muted">
            <tr>
              <th className="px-5 py-3">
                Allocation
              </th>

              <th className="px-5 py-3">
                Academic Period
              </th>

              <th className="px-5 py-3">
                Cohort
              </th>

              <th className="px-5 py-3">
                Trainer
              </th>

              <th className="px-5 py-3">
                Delivery
              </th>

              <th className="px-5 py-3">
                Room
              </th>

              <th className="px-5 py-3">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-soft">
            {allocations.map((allocation) => (
              <tr
                key={allocation.id}
                className="align-top transition hover:bg-surface-subtle"
              >
                <td className="min-w-64 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <BookOpen
                        className="size-4"
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <p className="font-semibold text-text-primary">
                        {allocation.unit?.name ??
                          'Unknown unit'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.unit?.code ??
                          'No unit code'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="neutral">
                          {getDeliveryModeLabel(
                            allocation.deliveryMode,
                          )}
                        </Badge>

                        <Badge variant="neutral">
                          {allocation.weeklySessions}{' '}
                          session
                          {allocation.weeklySessions === 1
                            ? ''
                            : 's'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </td>

                <td className="min-w-52 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <CalendarDays
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="font-medium text-text-primary">
                        {allocation.academicPeriod
                          ?.name ??
                          'Unknown period'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.academicPeriod
                          ?.code ?? 'No code'}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="min-w-52 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <GraduationCap
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="font-medium text-text-primary">
                        {allocation.cohort?.name ??
                          'Unknown cohort'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.cohort?.code ??
                          'No cohort code'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.cohort
                          ?.actualSize ?? 0}{' '}
                        learner
                        {allocation.cohort
                          ?.actualSize === 1
                          ? ''
                          : 's'}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="min-w-52 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <UserRound
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="font-medium text-text-primary">
                        {allocation.trainer
                          ?.fullName ??
                          'Unknown trainer'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.trainer
                          ?.staffNumber ??
                          'No staff number'}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="min-w-44 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Clock3
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="font-medium text-text-primary">
                        {formatWeeklyHours(
                          allocation,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {
                          allocation.sessionDurationMinutes
                        }{' '}
                        minutes per session
                      </p>
                    </div>
                  </div>
                </td>

                <td className="min-w-48 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Building2
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="font-medium text-text-primary">
                        {allocation.preferredRoom
                          ?.name ??
                          'No preferred room'}
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {allocation.preferredRoom
                          ?.code ??
                          'Generator may assign a room'}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="min-w-36 px-5 py-4">
                  <div className="flex flex-col items-start gap-2">
                    <Badge
                      variant={getStatusVariant(
                        allocation.status,
                      )}
                    >
                      {getStatusLabel(
                        allocation.status,
                      )}
                    </Badge>

                    <Badge
                      variant={
                        allocation.isTimetableEnabled
                          ? 'success'
                          : 'neutral'
                      }
                    >
                      {allocation.isTimetableEnabled
                        ? 'Timetable enabled'
                        : 'Not enabled'}
                    </Badge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}