'use client';

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import type {
  EditorData,
  EditorSession,
} from '@/features/timetable-editor/types';

import {
  quickMoveScheduleAction,
  quickReassignRoomAction,
  quickReassignTrainerAction,
  quickUndoLastChangeAction,
} from './actions';

import {
  initialQuickEditActionState,
  type QuickEditField,
} from './types';

/* ================================================================
   COMPACT CARD BUTTON

   The timetable day columns have a deliberately constrained width.
   Keep this button compact enough to sit beside "Move" without
   forcing either action outside the card.
   ================================================================ */

const DENSE_CARD_BUTTON_CLASSES = [
  'h-7',
  'min-h-7',
  'xl:min-h-7',
  '2xl:min-h-7',
  'w-full',
  'min-w-0',
  'max-w-full',
  'rounded-md',
  'px-1.5',
  'xl:px-1.5',
  '2xl:px-1.5',
  'py-0',
  'xl:py-0',
  'gap-1',
  'xl:gap-1',
  'text-[10px]',
  'xl:text-[10px]',
  '2xl:text-[10px]',
  'font-semibold',
  'leading-none',
  'whitespace-nowrap',
  'overflow-hidden',
].join(' ');

/* ================================================================
   QUICK EDIT PANEL
   ================================================================ */

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

  const [field, setField] =
    useState<QuickEditField>('schedule');

  /* ==============================================================
     ACTION STATES
     ============================================================== */

  const [
    scheduleState,
    scheduleAction,
    schedulePending,
  ] = useActionState(
    quickMoveScheduleAction,
    initialQuickEditActionState,
  );

  const [
    roomState,
    roomAction,
    roomPending,
  ] = useActionState(
    quickReassignRoomAction,
    initialQuickEditActionState,
  );

  const [
    trainerState,
    trainerAction,
    trainerPending,
  ] = useActionState(
    quickReassignTrainerAction,
    initialQuickEditActionState,
  );

  /* ==============================================================
     ACTIVE STATE
     ============================================================== */

  const activeState =
    field === 'schedule'
      ? scheduleState
      : field === 'room'
        ? roomState
        : trainerState;

  const pending =
    field === 'schedule'
      ? schedulePending
      : field === 'room'
        ? roomPending
        : trainerPending;

  /* ==============================================================
     SUCCESS REFRESH
     ============================================================== */

  useEffect(() => {
    if (activeState.status !== 'success') {
      return;
    }

    const timer = setTimeout(() => {
      setIsOpen(false);

      startTransition(() => {
        router.refresh();
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [
    activeState.status,
    router,
    startTransition,
  ]);

  /* ==============================================================
     LOCKED SESSION

     Locked sessions cannot be quick-edited. Render a disabled
     compact button to maintain the consistent dual-action footer.
     ============================================================== */

  if (session.isLocked) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title="Session is locked. Unlock in top-right to edit."
        aria-label="Quick edit disabled (locked)"
        className={[
          DENSE_CARD_BUTTON_CLASSES,
          'border-border-soft',
          'bg-surface-subtle/40',
          'text-text-muted',
          'cursor-not-allowed',
          'opacity-50',
        ].join(' ')}
      >
        <span className="block min-w-0 truncate">
          Quick
        </span>
      </Button>
    );
  }

  /* ==============================================================
     RENDER
     ============================================================== */

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      {/* ==========================================================
          CARD TRIGGER

          This is deliberately full-width and constrained.

          The parent grid gives this button roughly half of the
          available card footer. Therefore:
            - w-full
            - min-w-0
            - max-w-full
            - overflow-hidden
            - truncate

          are all intentional.
          ========================================================== */}

      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Quick Edit"
          aria-label="Quick Edit"
          className={[
            DENSE_CARD_BUTTON_CLASSES,
            'border-primary/20',
            'bg-surface',
            'text-text-secondary',
            'hover:border-primary/40',
            'hover:bg-primary-soft',
            'hover:text-primary',
            'transition-colors',
          ].join(' ')}
        >
          <span className="block min-w-0 truncate">
            Quick
          </span>
        </Button>
      </DialogTrigger>

      {/* ==========================================================
          DIALOG
          ========================================================== */}

      {isOpen ? (
        <DialogContent
          className="
            max-w-sm
            overflow-hidden
            p-0
          "
        >
          {/* ========================================================
              HEADER
              ======================================================== */}

          <DialogHeader
            className="
              border-b
              border-border
              px-4
              py-3
            "
          >
            <DialogTitle
              className="
                truncate
                text-sm
                font-bold
                text-text-primary
              "
            >
              {session.unitCode}
              {' · '}
              {session.cohortCode}
            </DialogTitle>
          </DialogHeader>

          {/* ========================================================
              EDIT MODE TABS

              Time / Room / Trainer
              ======================================================== */}

          <div
            className="
              grid
              grid-cols-3
              border-b
              border-border-soft
              bg-surface-subtle/30
            "
          >
            {(
              [
                'schedule',
                'room',
                'trainer',
              ] as QuickEditField[]
            ).map((option) => {
              const active =
                field === option;

              const label =
                option === 'schedule'
                  ? 'Time'
                  : option === 'room'
                    ? 'Room'
                    : 'Trainer';

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setField(option)
                  }
                  className={[
                    'relative',
                    'h-9',
                    'min-w-0',
                    'px-2',
                    'text-xs',
                    'font-semibold',
                    'transition-colors',
                    'focus:outline-none',
                    'focus-visible:ring-2',
                    'focus-visible:ring-primary/30',
                    active
                      ? 'text-primary'
                      : 'text-text-muted hover:text-text-secondary',
                  ].join(' ')}
                >
                  {label}

                  {active ? (
                    <span
                      className="
                        absolute
                        inset-x-0
                        bottom-0
                        h-0.5
                        bg-primary
                      "
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* ========================================================
              SCHEDULE / TIME
              ======================================================== */}

          {field === 'schedule' ? (
            <form action={scheduleAction}>
              <input
                type="hidden"
                name="sessionId"
                value={session.id}
              />

              <DialogBody
                className="
                  space-y-3.5
                  px-4
                  py-4
                "
              >
                {/* Day */}
                <Field label="Day">
                  <Select
                    name="workingDayId"
                    defaultValue={
                      session.workingDayId
                    }
                    required
                    className="w-full"
                  >
                    {data.workingDays.map(
                      (day) => (
                        <option
                          key={day.id}
                          value={day.id}
                        >
                          {day.label}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>

                {/* Time */}
                <Field label="Time">
                  <Select
                    name="startTimeSlotId"
                    defaultValue={
                      session.startTimeSlotId
                    }
                    required
                    className="w-full"
                  >
                    {data.timeSlots.map(
                      (slot) => (
                        <option
                          key={slot.id}
                          value={slot.id}
                        >
                          {slot.label}
                        </option>
                      ),
                    )}
                  </Select>

                  <input
                    type="hidden"
                    name="endTimeSlotId"
                    value={
                      session.endTimeSlotId
                    }
                  />
                </Field>

                <ConflictLine
                  state={scheduleState}
                />
              </DialogBody>

              <Footer
                pending={pending}
                onCancel={() =>
                  setIsOpen(false)
                }
              />
            </form>
          ) : null}

          {/* ========================================================
              ROOM
              ======================================================== */}

          {field === 'room' ? (
            <form action={roomAction}>
              <input
                type="hidden"
                name="sessionId"
                value={session.id}
              />

              <DialogBody
                className="
                  space-y-3.5
                  px-4
                  py-4
                "
              >
                <Field label="Room">
                  <Select
                    name="roomId"
                    defaultValue={
                      session.roomId ?? ''
                    }
                    required
                    className="w-full"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select a room
                    </option>

                    {data.rooms.map(
                      (room) => (
                        <option
                          key={room.id}
                          value={room.id}
                        >
                          {room.label}
                          {' · cap '}
                          {room.capacity}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>

                <ConflictLine
                  state={roomState}
                />
              </DialogBody>

              <Footer
                pending={pending}
                onCancel={() =>
                  setIsOpen(false)
                }
              />
            </form>
          ) : null}

          {/* ========================================================
              TRAINER
              ======================================================== */}

          {field === 'trainer' ? (
            <form action={trainerAction}>
              <input
                type="hidden"
                name="sessionId"
                value={session.id}
              />

              <input
                type="hidden"
                name="workingDayId"
                value={
                  session.workingDayId
                }
              />

              <input
                type="hidden"
                name="startTimeSlotId"
                value={
                  session.startTimeSlotId
                }
              />

              <input
                type="hidden"
                name="endTimeSlotId"
                value={
                  session.endTimeSlotId
                }
              />

              <input
                type="hidden"
                name="roomId"
                value={
                  session.roomId ?? ''
                }
              />

              <DialogBody
                className="
                  space-y-3.5
                  px-4
                  py-4
                "
              >
                <Field label="Trainer">
                  <Select
                    name="trainerId"
                    defaultValue={
                      session.trainerId ?? ''
                    }
                    required
                    className="w-full"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select a trainer
                    </option>

                    {data.trainers.map(
                      (trainer) => (
                        <option
                          key={trainer.id}
                          value={trainer.id}
                        >
                          {trainer.fullName}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>

                <ConflictLine
                  state={trainerState}
                />
              </DialogBody>

              <Footer
                pending={pending}
                onCancel={() =>
                  setIsOpen(false)
                }
              />
            </form>
          ) : null}

          {/* ========================================================
              UNDO

              Appears only after a successful save.
              ======================================================== */}

          {activeState.status ===
          'success' ? (
            <form
              action={async (
                formData: FormData,
              ) => {
                await quickUndoLastChangeAction(
                  formData,
                );
              }}
              className="
                -mt-1
                border-t
                border-border-soft
                px-4
                py-2.5
              "
            >
              <input
                type="hidden"
                name="academicPeriodId"
                value={
                  session.academicPeriodId
                }
              />

              <button
                type="submit"
                className="
                  text-[11px]
                  font-semibold
                  text-text-muted
                  underline
                  underline-offset-2
                  transition-colors
                  hover:text-primary
                "
              >
                Undo this change
              </button>
            </form>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/* ================================================================
   FIELD
   ================================================================ */

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className="
          block
          text-[11px]
          font-semibold
          text-text-muted
        "
      >
        {label}
      </span>

      {children}
    </label>
  );
}

/* ================================================================
   CONFLICT MESSAGE
   ================================================================ */

function ConflictLine({
  state,
}: {
  state: {
    status: string;
    message: string | null;
    suggestion?: string | null;
  };
}) {
  if (
    state.status !== 'error' ||
    !state.message
  ) {
    return null;
  }

  return (
    <p
      className="
        rounded-lg
        border
        border-danger-border/30
        bg-danger-surface/40
        px-2.5
        py-1.5
        text-[11px]
        leading-snug
        text-danger
      "
    >
      {state.message}

      {state.suggestion ? (
        <span className="mt-0.5 block text-text-muted">
          {state.suggestion}
        </span>
      ) : null}
    </p>
  );
}

/* ================================================================
   FOOTER
   ================================================================ */

function Footer({
  pending,
  onCancel,
}: {
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <DialogFooter
      className="
        flex
        items-center
        justify-end
        gap-2
        border-t
        border-border-soft
        px-4
        py-3
      "
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={pending}
        className="text-xs"
      >
        Cancel
      </Button>

      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="min-w-[64px] text-xs"
      >
        {pending
          ? 'Saving…'
          : 'Save'}
      </Button>
    </DialogFooter>
  );
}