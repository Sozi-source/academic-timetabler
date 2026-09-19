'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';

import type { EditorData, EditorSession } from '@/features/timetable-editor/types';
import {
  quickMoveScheduleAction,
  quickReassignRoomAction,
  quickReassignTrainerAction,
  quickUndoLastChangeAction,
} from './actions';
import { initialQuickEditActionState, type QuickEditField } from './types';

/**
 * Deliberately separate from SessionEditorCard's "Move / Edit" dialog.
 * That one edits every field in a single form (day, slot, room, trainer,
 * notes) and is the right tool for a real re-plan. This panel changes
 * exactly one field per open — see changes.md §4.3 "No modal stacking" —
 * and uses the picklists already loaded by the parent editor (EditorData),
 * so opening it costs zero extra queries; only Save does a write.
 */
export function QuickEditPanel({
  session,
  data,
}: {
  session: EditorSession;
  data: EditorData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [field, setField] = useState<QuickEditField>('schedule');

  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    quickMoveScheduleAction,
    initialQuickEditActionState,
  );
  const [roomState, roomAction, roomPending] = useActionState(
    quickReassignRoomAction,
    initialQuickEditActionState,
  );
  const [trainerState, trainerAction, trainerPending] = useActionState(
    quickReassignTrainerAction,
    initialQuickEditActionState,
  );

  const activeState = field === 'schedule' ? scheduleState : field === 'room' ? roomState : trainerState;
  const pending = field === 'schedule' ? schedulePending : field === 'room' ? roomPending : trainerPending;

  useEffect(() => {
    if (activeState.status === 'success') {
      const timer = setTimeout(() => {
        setIsOpen(false);
        startTransition(() => router.refresh());
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [activeState.status, router]);

  if (session.isLocked) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-semibold text-text-secondary hover:text-primary"
        >
          Quick Edit
        </Button>
      </DialogTrigger>

      {isOpen ? (
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="text-sm font-bold text-text-primary">
              {session.unitCode} · {session.cohortCode}
            </DialogTitle>
          </DialogHeader>

          <div className="flex border-b border-border-soft">
            {(['schedule', 'room', 'trainer'] as QuickEditField[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setField(option)}
                className={`flex-1 py-2 text-xs font-semibold capitalize transition ${
                  field === option
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {option === 'schedule' ? 'Time' : option}
              </button>
            ))}
          </div>

          {field === 'schedule' ? (
            <form action={scheduleAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <DialogBody className="px-4 py-3.5 space-y-3">
                <Field label="Day">
                  <Select name="workingDayId" defaultValue={session.workingDayId} required>
                    {data.workingDays.map((day) => (
                      <option key={day.id} value={day.id}>{day.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Time">
                  <Select name="startTimeSlotId" defaultValue={session.startTimeSlotId} required>
                    {data.timeSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>{slot.label}</option>
                    ))}
                  </Select>
                  <input type="hidden" name="endTimeSlotId" value={session.endTimeSlotId} />
                </Field>
                <ConflictLine state={scheduleState} />
              </DialogBody>
              <Footer pending={pending} onCancel={() => setIsOpen(false)} />
            </form>
          ) : field === 'room' ? (
            <form action={roomAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <DialogBody className="px-4 py-3.5 space-y-3">
                <Field label="Room">
                  <Select name="roomId" defaultValue={session.roomId ?? ''} required>
                    <option value="" disabled>Select a room</option>
                    {data.rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.label} · cap {room.capacity}</option>
                    ))}
                  </Select>
                </Field>
                <ConflictLine state={roomState} />
              </DialogBody>
              <Footer pending={pending} onCancel={() => setIsOpen(false)} />
            </form>
          ) : (
            <form action={trainerAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="workingDayId" value={session.workingDayId} />
              <input type="hidden" name="startTimeSlotId" value={session.startTimeSlotId} />
              <input type="hidden" name="endTimeSlotId" value={session.endTimeSlotId} />
              <input type="hidden" name="roomId" value={session.roomId ?? ''} />
              <DialogBody className="px-4 py-3.5 space-y-3">
                <Field label="Trainer">
                  <Select name="trainerId" defaultValue={session.trainerId ?? ''} required>
                    <option value="" disabled>Select a trainer</option>
                    {data.trainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>{trainer.fullName}</option>
                    ))}
                  </Select>
                </Field>
                <ConflictLine state={trainerState} />
              </DialogBody>
              <Footer pending={pending} onCancel={() => setIsOpen(false)} />
            </form>
          )}

          {activeState.status === 'success' ? (
            <form action={quickUndoLastChangeAction} className="px-4 pb-3 -mt-1">
              <input type="hidden" name="academicPeriodId" value={session.academicPeriodId} />
              <button type="submit" className="text-[11px] font-semibold text-text-muted hover:text-primary underline underline-offset-2">
                Undo this change
              </button>
            </form>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Exactly one line: the named clash (or a plain error), plus one suggested action. No extra copy. */
function ConflictLine({ state }: { state: { status: string; message: string | null; suggestion?: string | null } }) {
  if (state.status !== 'error' || !state.message) return null;
  return (
    <p className="text-[11px] text-danger leading-snug bg-danger-surface/40 border border-danger-border/30 rounded-lg px-2.5 py-1.5">
      {state.message}
      {state.suggestion ? <span className="block text-text-muted mt-0.5">{state.suggestion}</span> : null}
    </p>
  );
}

function Footer({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <DialogFooter className="px-4 py-3 border-t border-border-soft flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </DialogFooter>
  );
}
