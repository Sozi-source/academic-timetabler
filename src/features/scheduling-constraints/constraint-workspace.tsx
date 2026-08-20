import type { ReactNode } from 'react';
import { Ban, CheckCircle2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  deleteSchedulingConstraintAction,
  toggleSchedulingConstraintAction,
} from './actions';
import { ConstraintForm } from './constraint-form';
import type {
  SchedulingConstraint,
  SchedulingConstraintData,
  TimeSlotOption,
} from './types';

const subjectLabels = {
  trainer: 'Trainer',
  room: 'Room',
  cohort: 'Cohort',
  institution: 'Institution',
} as const;

const typeLabels = {
  unavailable: 'Unavailable',
  preferred: 'Advisory (legacy)',
  required: 'Fixed session (legacy)',
  protected_day: 'Unavailable',
} as const;

export function ConstraintWorkspace({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: SchedulingConstraintData;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4 xl:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Add constraint
          </h2>
          <p className="mt-1 text-xs text-text-muted xl:text-sm">
            Block exceptional days or teaching sessions. Normal trainer availability is managed separately.
          </p>
        </div>

        <ConstraintForm
          academicPeriodId={academicPeriodId}
          trainers={data.trainers}
          rooms={data.rooms}
          cohorts={data.cohorts}
          workingDays={data.workingDays}
          timeSlots={data.timeSlots}
        />
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Constraint register
          </h2>
        </div>

        {data.constraints.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            No constraints configured for this Academic Period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs xl:text-sm">
              <thead className="bg-surface-subtle text-text-secondary">
                <tr>
                  <Th>Subject</Th>
                  <Th>Rule</Th>
                  <Th>When</Th>
                  <Th>Priority</Th>
                  <Th>Reason</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.constraints.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <Td>
                      <div className="font-medium text-text-primary">
                        {item.subjectLabel}
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
                        {subjectLabels[item.subjectType]}
                      </div>
                    </Td>
                    <Td>{typeLabels[item.constraintType]}</Td>
                    <Td>{formatWhen(item, data.timeSlots)}</Td>
                    <Td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold xl:text-xs ${
                          item.priority === 'hard'
                            ? 'bg-danger-surface text-danger'
                            : 'bg-warning-surface text-warning'
                        }`}
                      >
                        {item.priority === 'hard' ? 'Hard' : 'Soft'}
                      </span>
                    </Td>
                    <Td className="max-w-[16rem] text-text-secondary">
                      {formatReason(item)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <form action={toggleSchedulingConstraintAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={String(!item.isActive)}
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            leadingIcon={
                              item.isActive ? (
                                <Ban className="size-3.5" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )
                            }
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </Button>
                        </form>

                        <form action={deleteSchedulingConstraintAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete constraint"
                            title="Delete constraint"
                            className="size-9 text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


function formatReason(item: SchedulingConstraint) {
  const reason = item.reason?.trim();

  if (!reason) return '-';
  if (
    reason === 'Preferred scheduling time' ||
    reason === 'Required scheduling time' ||
    reason === 'Protected day'
  ) {
    return '-';
  }

  return reason;
}

function formatWhen(
  item: SchedulingConstraint,
  timeSlots: TimeSlotOption[],
) {
  const day = item.workingDayLabel ?? 'Any day';

  if (!item.startsAt || !item.endsAt) {
    return (
      <div>
        <div className="font-medium text-text-primary">{day}</div>
        <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
          All day
        </div>
      </div>
    );
  }

  const startsAt = item.startsAt.slice(0, 5);
  const endsAt = item.endsAt.slice(0, 5);
  const session = timeSlots.find(
    (slot) => slot.startsAt === startsAt && slot.endsAt === endsAt,
  );

  return (
    <div>
      <div className="font-medium text-text-primary">{day}</div>
      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
        {session?.label ?? `${startsAt}-${endsAt}`}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2.5 font-semibold">{children}</th>;
}

function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2.5 align-middle ${className}`}>
      {children}
    </td>
  );
}
