'use client';

import {
  AlertTriangle,
  Lock,
  LockOpen,
  MoveRight,
  LoaderCircle,
  Users,
  User,
  MapPin,
  FileText,
  Settings,
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

import { cn } from '@/lib/utils/cn';
import { moveScheduledSessionAction, toggleScheduledSessionLockAction } from './actions';
import { initialEditorActionState, type EditorData, type EditorSession } from './types';

export function formatTrainerAbbreviation(fullName: string): string {
  if (!fullName || fullName === 'Unassigned trainer' || fullName === 'Unassigned') {
    return fullName;
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const initial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${initial}.`;
}

export function SessionEditorCard({
  session,
  data,
}: {
  session: EditorSession;
  data: EditorData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState(
    moveScheduledSessionAction,
    initialEditorActionState,
  );
  const [isOpen, setIsOpen] = useState(false);
  const trainerUnassigned = !session.trainerId;
  const roomUnassigned = !session.roomId;

  // Auto-close dialog on success and refresh without losing scroll position
  useEffect(() => {
    if (state.status === 'success') {
      const scrollY = window.scrollY;
      const timer = setTimeout(() => {
        setIsOpen(false);
        startTransition(() => {
          router.refresh();
          // Restore scroll after refresh paint
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo({ top: scrollY, behavior: 'instant' });
            });
          });
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.status, router]);


  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:border-border-strong',
        trainerUnassigned
          ? 'bg-institutional-yellow-subtle border-institutional-yellow/40 border-l-4 border-l-institutional-yellow'
          : 'bg-surface border-border-soft border-t-2 border-t-primary/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-md bg-primary-soft/50 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
            {session.unitCode}
          </span>
          <h3
            className="mt-1.5 text-xs font-bold text-text-primary leading-snug line-clamp-2"
            title={session.unitName}
          >
            {session.unitName}
          </h3>
        </div>

        {!trainerUnassigned ? (
          <form action={toggleScheduledSessionLockAction} className="shrink-0">
            <input type="hidden" name="sessionId" value={session.id} />
            <Button
              type="submit"
              size="icon"
              variant={session.isLocked ? 'secondary' : 'ghost'}
              className="size-8 rounded-lg"
              aria-label={session.isLocked ? 'Unlock session' : 'Lock session'}
              title={session.isLocked ? 'Unlock session' : 'Lock session'}
            >
              {session.isLocked ? (
                <Lock className="size-3.5 text-primary" />
              ) : (
                <LockOpen className="size-3.5 text-text-muted" />
              )}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-3.5 space-y-2 border-t border-border-soft pt-3 text-[11px]">
        <div className="flex items-center gap-2 text-text-secondary">
          <Users className="size-3.5 shrink-0 text-primary/70" />
          <span className="truncate font-medium">{session.cohortName}</span>
        </div>

        {trainerUnassigned ? (
          <div className="flex items-center gap-2 text-warning-ink font-semibold bg-warning-surface/60 border border-warning-border/40 px-2 py-0.5 rounded-md w-fit">
            <AlertTriangle className="size-3.5 shrink-0 text-warning" />
            <span className="text-[10px]">Trainer Pending</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-text-secondary">
            <User className="size-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{formatTrainerAbbreviation(session.trainerName)}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-text-secondary">
          <MapPin className={`size-3.5 shrink-0 ${roomUnassigned ? 'text-warning' : 'text-primary/70'}`} />
          {roomUnassigned ? (
            <span className="truncate font-semibold text-warning-ink bg-warning-surface/60 border border-warning-border/40 px-1.5 py-0.5 rounded text-[10px]">
              Room Pending
            </span>
          ) : (
            <span className="truncate">{session.roomName}</span>
          )}
        </div>

        {session.notes && session.notes !== 'Generated by the institutional timetabler.' ? (
          <div className="flex items-start gap-1.5 text-[11px] text-text-muted italic bg-surface-subtle p-2 rounded-lg border border-border-soft mt-1">
            <FileText className="size-3.5 shrink-0 text-text-subtle mt-0.5" />
            <span className="line-clamp-2 leading-relaxed">{session.notes}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 pt-3 border-t border-border-soft flex items-center justify-between gap-2">
        {session.isLocked ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted py-1">
            <Lock className="size-3" />
            Protected from edits
          </span>
        ) : (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs font-bold rounded-lg border-primary/20 text-primary bg-white hover:bg-primary-soft hover:border-primary/40 transition-colors"
                leadingIcon={<Settings className="size-3.5" />}
              >
                Move / Edit
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Move or Edit Session</DialogTitle>
              </DialogHeader>

              <form action={action}>
                <DialogBody className="space-y-4">
                  <input type="hidden" name="sessionId" value={session.id} />

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-subtle/30 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center rounded-md bg-primary-soft/50 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20 shrink-0">
                        {session.unitCode}
                      </span>
                      <span className="font-bold text-text-primary truncate" title={session.unitName}>
                        {session.unitName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted font-medium shrink-0">
                      <span>{session.cohortCode}</span>
                      <span>·</span>
                      <span>{formatTrainerAbbreviation(session.trainerName || 'Unassigned')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Day of Week</label>
                      <Select
                        name="workingDayId"
                        defaultValue={session.workingDayId}
                        aria-label="Working day"
                        className="w-full"
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
                        defaultValue={session.startTimeSlotId}
                        aria-label="Time slot"
                        className="w-full"
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
                        defaultValue={session.trainerId ?? ''}
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
                        defaultValue={session.roomId ?? ''}
                        aria-label="Room"
                        className="w-full"
                      >
                        <option value="">No room</option>
                        {data.rooms.map((room) => (
                          <option
                            key={room.id}
                            value={room.id}
                            disabled={room.capacity < session.cohortSize}
                          >
                            {room.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Note</label>
                    <input
                      name="notes"
                      defaultValue={
                        session.notes === 'Generated by the institutional timetabler.'
                          ? ''
                          : (session.notes ?? '')
                      }
                      placeholder="e.g., Clinical rotation swap"
                      className="h-9 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary placeholder:text-text-muted"
                    />
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
                        <MoveRight className="size-4" />
                      )
                    }
                  >
                    {pending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </article>
  );
}
