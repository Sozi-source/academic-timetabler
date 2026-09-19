'use client';

import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  LoaderCircle,
  Lock,
  PlusCircle,
  Users,
} from 'lucide-react';
import { useActionState, useState, useEffect, useTransition, useMemo } from 'react';
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

  // Controlled form state so user selections are preserved across errors and re-renders
  const [workingDayId, setWorkingDayId] = useState(data.workingDays[0]?.id ?? '');
  const [timeSlotId, setTimeSlotId] = useState(data.timeSlots[0]?.id ?? '');
  const [trainerId, setTrainerId] = useState(allocation.trainerId ?? '');
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [isLocked, setIsLocked] = useState(true);

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

  const selectedSlot = useMemo(() => {
    return data.timeSlots.find((s) => s.id === timeSlotId);
  }, [data.timeSlots, timeSlotId]);

  const selectedTrainer = useMemo(() => {
    return data.trainers.find((t) => t.id === trainerId);
  }, [data.trainers, trainerId]);

  const selectedRoom = useMemo(() => {
    return data.rooms.find((r) => r.id === roomId);
  }, [data.rooms, roomId]);

  const availableCohorts = useMemo(() => {
    if (allocation.participantCohorts && allocation.participantCohorts.length > 0) {
      return allocation.participantCohorts;
    }
    const set = new Map<string, string>();
    set.set(allocation.cohortId, allocation.cohortCode);
    (allocation.participantCohortIds || []).forEach((id, idx) => {
      set.set(id, allocation.participantCohortCodes?.[idx] ?? 'Cohort');
    });
    return Array.from(set.entries()).map(([id, code]) => ({ id, code }));
  }, [
    allocation.cohortId,
    allocation.cohortCode,
    allocation.participantCohortIds,
    allocation.participantCohortCodes,
    allocation.participantCohorts,
  ]);

  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>(() =>
    availableCohorts.map((c) => c.id)
  );
  const [prevAllocationId, setPrevAllocationId] = useState(allocation.id);

  if (prevAllocationId !== allocation.id) {
    setPrevAllocationId(allocation.id);
    setSelectedCohortIds(availableCohorts.map((c) => c.id));
  }

  // Real-time client-side clash detection against current timetable sessions
  const conflicts = useMemo(() => {
    if (!selectedSlot || !workingDayId) return null;

    const candidateStart = selectedSlot.startsAt;
    const candidateEnd = selectedSlot.endsAt;

    const overlappingSessions = data.sessions.filter((session) => {
      if (session.workingDayId !== workingDayId) return false;
      const sessionStart = data.timeSlots.find((s) => s.id === session.startTimeSlotId);
      const sessionEnd = data.timeSlots.find((s) => s.id === session.endTimeSlotId) ?? sessionStart;
      if (!sessionStart || !sessionEnd) return false;
      return sessionStart.startsAt < candidateEnd && candidateStart < sessionEnd.endsAt;
    });

    // 1. Cohort clash - evaluated strictly against selected cohorts
    const targetCohortIds = new Set(
      selectedCohortIds.length > 0 ? selectedCohortIds : [allocation.cohortId]
    );

    let cohortClash: {
      cohortCode: string;
      ownerCohortCode: string;
      unitCode: string;
      unitName: string;
      trainerName: string;
      roomName: string;
      isSharedPartner: boolean;
    } | null = null;

    for (const session of overlappingSessions) {
      const sessionCohortIds = new Set(session.participantCohorts.map((p) => p.id));
      for (const targetId of targetCohortIds) {
        if (sessionCohortIds.has(targetId)) {
          const clashingPartner = session.participantCohorts.find((p) => p.id === targetId);
          const cohortCode = clashingPartner?.code ?? session.cohortCode;
          cohortClash = {
            cohortCode,
            ownerCohortCode: session.cohortCode,
            unitCode: session.unitCode,
            unitName: session.unitName,
            trainerName: session.trainerName,
            roomName: session.roomName,
            isSharedPartner: targetId !== allocation.cohortId,
          };
          break;
        }
      }
      if (cohortClash) break;
    }

    // 2. Trainer clash
    let trainerClash: {
      trainerName: string;
      unitCode: string;
      cohortCode: string;
      roomName: string;
    } | null = null;

    if (trainerId) {
      const clashingSession = overlappingSessions.find((s) => s.trainerId === trainerId);
      if (clashingSession) {
        trainerClash = {
          trainerName: selectedTrainer?.fullName ?? clashingSession.trainerName,
          unitCode: clashingSession.unitCode,
          cohortCode: clashingSession.cohortCode,
          roomName: clashingSession.roomName,
        };
      }
    }

    // 3. Room clash
    let roomClash: {
      roomName: string;
      unitCode: string;
      cohortCode: string;
    } | null = null;

    if (roomId) {
      const clashingSession = overlappingSessions.find((s) => s.roomId === roomId);
      if (clashingSession) {
        roomClash = {
          roomName: selectedRoom?.label ?? clashingSession.roomName,
          unitCode: clashingSession.unitCode,
          cohortCode: clashingSession.cohortCode,
        };
      }
    }

    return {
      hasClash: Boolean(cohortClash || trainerClash || roomClash),
      cohortClash,
      trainerClash,
      roomClash,
    };
  }, [
    data.sessions,
    data.timeSlots,
    workingDayId,
    selectedSlot,
    selectedCohortIds,
    allocation.cohortId,
    trainerId,
    selectedTrainer?.fullName,
    roomId,
    selectedRoom?.label,
  ]);

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
        <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3.5 pr-12 border-b border-border shrink-0">
            <DialogTitle className="text-base font-bold text-text-primary">Place Unit on Timetable</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-text-muted">
              Assign this session directly to a Day, Time Slot, and Room based on your physical master timetable.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <DialogBody className="px-5 py-3.5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
              <input type="hidden" name="allocationId" value={allocation.id} />
              <input type="hidden" name="participantCohortIds" value={JSON.stringify(selectedCohortIds)} />

              <div className="rounded-xl border border-border-soft bg-surface-subtle/50 p-3 text-xs space-y-2">
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

                {allocation.isSharedClass && availableCohorts.length > 1 ? (
                  <div className="space-y-2 rounded-lg border border-primary/20 bg-primary-soft/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-text-primary flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        Participating Cohorts ({selectedCohortIds.length}/{availableCohorts.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedCohortIds.length === 1 && selectedCohortIds[0] === allocation.cohortId) {
                            setSelectedCohortIds(availableCohorts.map((c) => c.id));
                          } else {
                            setSelectedCohortIds([allocation.cohortId]);
                          }
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {selectedCohortIds.length === 1 && selectedCohortIds[0] === allocation.cohortId
                          ? 'Include All Shared'
                          : `Only ${allocation.cohortCode}`}
                      </button>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Uncheck partner cohorts to schedule a standalone session for {allocation.cohortCode} without partner conflicts.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {availableCohorts.map((c) => {
                        const isSelected = selectedCohortIds.includes(c.id);
                        const isPrimary = c.id === allocation.cohortId;
                        return (
                          <label
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border cursor-pointer select-none transition-colors ${
                              isSelected
                                ? 'bg-primary-soft/90 border-primary/50 text-primary font-bold'
                                : 'bg-surface border-border-soft text-text-muted hover:border-border'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isPrimary && selectedCohortIds.length === 1}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCohortIds((prev) => Array.from(new Set([...prev, c.id])));
                                } else {
                                  if (selectedCohortIds.length > 1) {
                                    setSelectedCohortIds((prev) => prev.filter((id) => id !== c.id));
                                  }
                                }
                              }}
                              className="size-3 rounded border-border-strong text-primary accent-primary"
                            />
                            <span>{c.code}</span>
                            {isPrimary ? <span className="text-[10px] text-primary/70 font-normal">(Primary)</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Day of Week</label>
                  <Select
                    name="workingDayId"
                    value={workingDayId}
                    onChange={(e) => setWorkingDayId(e.target.value)}
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
                    value={timeSlotId}
                    onChange={(e) => setTimeSlotId(e.target.value)}
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
                    value={trainerId}
                    onChange={(e) => setTrainerId(e.target.value)}
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
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Physical master placement"
                  className="h-9 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary placeholder:text-text-muted"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft/30 p-3 text-xs">
                <input type="hidden" name="isLocked" value={isLocked ? 'true' : 'false'} />
                <input
                  type="checkbox"
                  id={`lock-${allocation.id}`}
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="size-4 rounded border-border-strong text-primary accent-primary focus:ring-primary"
                />
                <label htmlFor={`lock-${allocation.id}`} className="cursor-pointer font-medium text-text-primary flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  Hard-fix / Lock this session immediately
                </label>
              </div>

              {/* Real-time clash status indicator */}
              {conflicts?.cohortClash ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-4 shrink-0 text-danger" />
                    {conflicts.cohortClash.isSharedPartner
                      ? `Shared Partner Conflict: Cohort ${conflicts.cohortClash.cohortCode}`
                      : `Cohort Conflict: ${conflicts.cohortClash.cohortCode}`}
                  </div>
                  <p className="leading-relaxed">
                    {conflicts.cohortClash.isSharedPartner ? (
                      <>
                        Partner cohort <strong>{conflicts.cohortClash.cohortCode}</strong> (sharing this unit) already has{' '}
                        <strong>{conflicts.cohortClash.unitCode} {conflicts.cohortClash.unitName}</strong> with {conflicts.cohortClash.trainerName} in {conflicts.cohortClash.roomName} at this time.
                      </>
                    ) : (
                      <>
                        Cohort <strong>{conflicts.cohortClash.cohortCode}</strong> already has{' '}
                        <strong>{conflicts.cohortClash.unitCode} {conflicts.cohortClash.unitName}</strong> with {conflicts.cohortClash.trainerName} in {conflicts.cohortClash.roomName} at this time.
                        {conflicts.cohortClash.ownerCohortCode !== conflicts.cohortClash.cohortCode ? (
                          <> That session is a shared class led by <strong>{conflicts.cohortClash.ownerCohortCode}</strong>.</>
                        ) : null}
                      </>
                    )}
                  </p>
                  {conflicts.cohortClash.isSharedPartner ? (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCohortIds([allocation.cohortId])}
                        className="inline-flex items-center gap-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger text-[11px] font-bold px-2.5 py-1.5 transition-colors border border-danger/30 cursor-pointer"
                      >
                        Exclude partner cohorts & place for {allocation.cohortCode} only
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-danger/85 font-medium">
                      All participating cohorts must be free simultaneously. Please choose an alternative slot or day.
                    </p>
                  )}
                </div>
              ) : conflicts?.trainerClash ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-4 shrink-0 text-danger" />
                    Trainer Conflict: {conflicts.trainerClash.trainerName}
                  </div>
                  <p className="leading-relaxed">
                    <strong>{conflicts.trainerClash.trainerName}</strong> is already teaching <strong>{conflicts.trainerClash.unitCode}</strong> to {conflicts.trainerClash.cohortCode} in {conflicts.trainerClash.roomName} at this time.
                  </p>
                </div>
              ) : conflicts?.roomClash ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-4 shrink-0 text-danger" />
                    Room Conflict: {conflicts.roomClash.roomName}
                  </div>
                  <p className="leading-relaxed">
                    Room <strong>{conflicts.roomClash.roomName}</strong> is already occupied by <strong>{conflicts.roomClash.unitCode}</strong> ({conflicts.roomClash.cohortCode}) at this time.
                  </p>
                </div>
              ) : selectedSlot ? (
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-2.5 text-xs text-success font-medium">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Slot is completely available for all cohorts, trainer, and room.</span>
                </div>
              ) : null}

              {state.message ? (
                <FormStatusMessage
                  status={state.status === 'success' ? 'success' : 'error'}
                  message={state.message}
                />
              ) : null}
            </DialogBody>

            <DialogFooter className="px-5 py-3 border-t border-border bg-surface shrink-0 flex flex-row items-center justify-end gap-2">
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
                disabled={pending || (conflicts?.hasClash ?? false)}
                title={conflicts?.hasClash ? 'Resolve existing conflicts before placing' : undefined}
                leadingIcon={
                  pending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )
                }
              >
                {pending ? 'Placing...' : conflicts?.hasClash ? 'Conflict Detected' : 'Schedule & Lock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
