'use client';

import {
  CalendarPlus,
  LoaderCircle,
  Lock,
  PlusCircle,
} from 'lucide-react';
import { useActionState, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';

import { scheduleAllocationSessionAction } from './actions';
import { initialEditorActionState, type EditorData } from './types';

interface ScheduleAllocationDialogProps {
  allocation: EditorData['missingAllocations'][number];
  data: EditorData;
}

export function ScheduleAllocationDialog({
  allocation,
  data,
}: ScheduleAllocationDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState(
    scheduleAllocationSessionAction,
    initialEditorActionState,
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (state.status === 'success') {
      const scrollY = window.scrollY;
      const timer = setTimeout(() => {
        setIsOpen(false);
        startTransition(() => {
          router.refresh();
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
          });
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.status, router]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="mt-3 w-full text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm"
          leadingIcon={<PlusCircle className="size-3.5" />}
        >
          Place on Timetable
        </Button>
      </DialogTrigger>

      {isOpen ? (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Place Unit on Timetable</DialogTitle>
            <DialogDescription>
              Assign this session directly to a Day, Time Slot, and Room based on your physical master timetable.
            </DialogDescription>
          </DialogHeader>

          <form action={action}>
            <DialogBody className="space-y-4">
              <input type="hidden" name="allocationId" value={allocation.id} />

              <div className="rounded-xl border border-border-soft bg-surface-subtle/50 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary-soft/60 px-2 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
                    {allocation.unitCode}
                  </span>
                  <span className="font-semibold text-text-secondary">{allocation.cohortCode}</span>
                </div>
                <p className="font-bold text-text-primary">{allocation.unitName}</p>
                <p className="text-text-muted">
                  Default Trainer: <span className="font-medium text-text-primary">{allocation.trainerName}</span> · Missing: {allocation.missingSessionCount} session{allocation.missingSessionCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Day of Week</label>
                  <Select
                    name="workingDayId"
                    defaultValue={data.workingDays[0]?.id}
                    aria-label="Working day"
                    className="w-full"
                    required
                  >
                    {data.workingDays.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Time Slot</label>
                  <Select
                    name="timeSlotId"
                    defaultValue={data.timeSlots[0]?.id}
                    aria-label="Time slot"
                    className="w-full"
                    required
                  >
                    {data.timeSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Trainer</label>
                  <Select
                    name="trainerId"
                    defaultValue={allocation.trainerId ?? ''}
                    aria-label="Trainer"
                    className="w-full"
                  >
                    <option value="">Unassigned</option>
                    {data.trainers.map((t) => {
                      const isGuest = data.profile && t.departmentId !== data.profile.activeDepartmentId;
                      const workloadLabel = isGuest
                        ? `Guest · ${t.allocatedHours}h`
                        : `${t.allocatedHours}h`;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({workloadLabel})
                        </option>
                      );
                    })}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Room</label>
                  <Select
                    name="roomId"
                    defaultValue={data.rooms[0]?.id ?? ''}
                    aria-label="Room"
                    className="w-full"
                  >
                    <option value="">No room assigned</option>
                    {data.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.label}
                        {room.capacity > 0 ? ` (${room.capacity} cap)` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Note (Optional)</label>
                <input
                  name="notes"
                  placeholder="e.g., Physical master placement"
                  className="h-9 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary placeholder:text-text-muted"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft/30 p-3 text-xs">
                <input
                  type="checkbox"
                  id={`lock-${allocation.id}`}
                  name="isLocked"
                  value="true"
                  defaultChecked
                  className="size-4 rounded border-border-strong text-primary accent-primary focus:ring-primary"
                />
                <label htmlFor={`lock-${allocation.id}`} className="cursor-pointer font-medium text-text-primary flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  Hard-fix / Lock this session immediately
                </label>
              </div>

              {state.message ? (
                <FormStatusMessage
                  status={state.status === 'success' ? 'success' : 'error'}
                  message={state.message}
                />
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                leadingIcon={
                  pending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )
                }
              >
                {pending ? 'Placing...' : 'Schedule & Lock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
