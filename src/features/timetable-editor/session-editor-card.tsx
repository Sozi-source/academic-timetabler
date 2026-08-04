'use client';

import { Lock, LockOpen, MoveRight, LoaderCircle } from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import { moveScheduledSessionAction, toggleScheduledSessionLockAction } from './actions';
import { initialEditorActionState, type EditorData, type EditorSession } from './types';

export function SessionEditorCard({
  session,
  data,
}: {
  session: EditorSession;
  data: EditorData;
}) {
  const [state, action, pending] = useActionState(
    moveScheduledSessionAction,
    initialEditorActionState,
  );

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{session.unitCode} · {session.unitName}</p>
          <p className="mt-1 text-xs text-text-muted">{session.cohortName} · {session.trainerName}</p>
        </div>
        <form action={toggleScheduledSessionLockAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <Button
            type="submit"
            size="icon"
            variant={session.isLocked ? 'secondary' : 'ghost'}
            aria-label={session.isLocked ? 'Unlock session' : 'Lock session'}
            title={session.isLocked ? 'Unlock session' : 'Lock session'}
          >
            {session.isLocked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          </Button>
        </form>
      </div>

      <p className="mt-2 text-xs font-medium text-text-secondary">{session.roomCode} · {session.roomName}</p>

      {!session.isLocked ? (
        <form action={action} className="mt-3 grid gap-2">
          <input type="hidden" name="sessionId" value={session.id} />
          <Select name="workingDayId" defaultValue={session.workingDayId} aria-label="Working day">
            {data.workingDays.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select name="startTimeSlotId" defaultValue={session.startTimeSlotId} aria-label="Start slot">
              {data.timeSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
            </Select>
            <Select name="endTimeSlotId" defaultValue={session.endTimeSlotId} aria-label="End slot">
              {data.timeSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
            </Select>
          </div>
          <Select name="roomId" defaultValue={session.roomId} aria-label="Room">
            {data.rooms.map((room) => <option key={room.id} value={room.id} disabled={room.capacity < session.cohortSize}>{room.label}</option>)}
          </Select>
          <input
            name="notes"
            defaultValue={session.notes ?? ''}
            placeholder="Optional edit note"
            className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={pending} leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin" /> : <MoveRight className="size-4" />}>
            {pending ? 'Checking move' : 'Move session'}
          </Button>
          {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}
        </form>
      ) : (
        <p className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-muted">Locked sessions are protected from edits and regeneration.</p>
      )}
    </article>
  );
}
