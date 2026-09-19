'use client';

import {
  AlertTriangle,
  FileText,
  LoaderCircle,
  Lock,
  LockOpen,
  MapPin,
  MoveRight,
  Settings,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { cn } from '@/lib/utils/cn';

import {
  moveScheduledSessionAction,
  toggleScheduledSessionLockAction,
  unscheduleSessionAction,
} from './actions';

import {
  initialEditorActionState,
  type EditorData,
  type EditorSession,
} from './types';

import { QuickEditPanel } from '@/features/timetable-quick-edit/quick-edit-panel';

/* ================================================================
   TRAINER NAME
   ================================================================ */

export function formatTrainerAbbreviation(
  fullName: string,
): string {
  if (
    !fullName ||
    fullName === 'Unassigned trainer' ||
    fullName === 'Unassigned'
  ) {
    return fullName;
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length <= 1) {
    return fullName;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  const initial = lastName.charAt(0).toUpperCase();

  return `${firstName} ${initial}.`;
}

/* ================================================================
   SESSION EDITOR CARD
   ================================================================ */

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

  const timeSlot = data.timeSlots.find(
    (slot) => slot.id === session.startTimeSlotId,
  );

  /* ==============================================================
     SUCCESS REFRESH
     ============================================================== */

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }

    const scrollY = window.scrollY;

    const timer = setTimeout(() => {
      setIsOpen(false);

      startTransition(() => {
        router.refresh();

        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollY,
            behavior: 'instant',
          });
        });
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [state.status, router, startTransition]);

  /* ==============================================================
     RENDER
     ============================================================== */

  return (
    <article
      className={cn(
        'relative flex flex-col justify-between min-h-[255px] rounded-xl border p-3',
        'shadow-[0_1px_3px_rgba(0,0,0,0.02)]',
        'transition-shadow transition-colors',
        'hover:border-border-strong',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]',

        trainerUnassigned
          ? [
              'border-institutional-yellow/40',
              'border-l-4',
              'border-l-institutional-yellow',
              'bg-institutional-yellow-subtle',
            ]
          : [
              'border-border-soft',
              'border-t-2',
              'border-t-primary/60',
              'bg-surface',
            ],
      )}
    >
      {/* ============================================================
          HEADER
          Unit code + Hard-Fixed status + lock control
          ============================================================ */}

      <div className="flex items-start justify-between gap-2">
        {/* Unit information */}
        <div className="min-w-0">
          <span
            className="
              inline-flex
              max-w-full
              items-center
              rounded-md
              border
              border-primary/20
              bg-primary-soft/50
              px-2
              py-0.5
              text-[10px]
              font-bold
              text-primary
            "
          >
            {session.unitCode}
          </span>

          {/* Hard-fixed is deliberately on its own line (spacer equalizes header height when unlocked) */}
          {session.isLocked ? (
            <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-primary">
              <Lock className="size-2.5 shrink-0" />

              <span>Hard-Fixed</span>
            </div>
          ) : (
            <div className="mt-1 h-3.5" aria-hidden="true" />
          )}
        </div>

        {/* Lock / unlock */}
        {!trainerUnassigned ? (
          <form
            action={toggleScheduledSessionLockAction}
            className="shrink-0"
          >
            <input
              type="hidden"
              name="sessionId"
              value={session.id}
            />

            <Button
              type="submit"
              size="icon"
              variant={
                session.isLocked
                  ? 'secondary'
                  : 'ghost'
              }
              className="size-7 rounded-lg"
              aria-label={
                session.isLocked
                  ? 'Unlock session'
                  : 'Lock session'
              }
              title={
                session.isLocked
                  ? 'Unlock session'
                  : 'Lock session'
              }
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

      {/* ============================================================
          TIME
          ============================================================ */}

      {timeSlot ? (
        <p
          className="mt-2 text-[10px] font-semibold text-text-muted"
          title={timeSlot.label}
        >
          {timeSlot.startsAt.slice(0, 5)}
          {'–'}
          {timeSlot.endsAt.slice(0, 5)}
        </p>
      ) : null}

      {/* ============================================================
          UNIT NAME
          ============================================================ */}

      <h3
        className="
          mt-2
          break-words
          text-xs
          font-bold
          leading-snug
          text-text-primary
          line-clamp-2
          min-h-[2.25rem]
        "
        title={session.unitName}
      >
        {session.unitName}
      </h3>

      {/* ============================================================
          DETAILS
          ============================================================ */}

      <div
        className="
          mt-2.5
          space-y-1.5
          border-t
          border-border-soft
          pt-2.5
          text-[11px]
        "
      >
        {/* Cohort */}
        <div className="flex min-w-0 items-center gap-2 text-text-secondary">
          <Users className="size-3.5 shrink-0 text-primary/70" />

          <span className="truncate font-medium">
            {session.cohortName}
          </span>
        </div>

        {/* Trainer */}
        {trainerUnassigned ? (
          <div
            className="
              flex
              w-fit
              items-center
              gap-2
              rounded-md
              border
              border-warning-border/40
              bg-warning-surface/60
              px-2
              py-0.5
              font-semibold
              text-warning-ink
            "
          >
            <AlertTriangle className="size-3.5 shrink-0 text-warning" />

            <span className="text-[10px]">
              Trainer Pending
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-text-secondary">
            <User className="size-3.5 shrink-0 text-primary/70" />

            <span className="truncate">
              {formatTrainerAbbreviation(
                session.trainerName,
              )}
            </span>
          </div>
        )}

        {/* Room */}
        <div className="flex min-w-0 items-center gap-2 text-text-secondary">
          <MapPin
            className={cn(
              'size-3.5 shrink-0',
              roomUnassigned
                ? 'text-warning'
                : 'text-primary/70',
            )}
          />

          {roomUnassigned ? (
            <span
              className="
                truncate
                rounded
                border
                border-warning-border/40
                bg-warning-surface/60
                px-1.5
                py-0.5
                text-[10px]
                font-semibold
                text-warning-ink
              "
            >
              Room Pending
            </span>
          ) : (
            <span className="truncate">
              {session.roomName}
            </span>
          )}
        </div>

        {/* Notes */}
        {session.notes &&
        session.notes !==
          'Generated by the institutional timetabler.' ? (
          <div
            className="
              mt-1
              flex
              items-start
              gap-1.5
              rounded-lg
              border
              border-border-soft
              bg-surface-subtle
              p-2
              text-[11px]
              italic
              text-text-muted
            "
          >
            <FileText className="mt-0.5 size-3.5 shrink-0 text-text-subtle" />

            <span className="line-clamp-2 leading-relaxed">
              {session.notes}
            </span>
          </div>
        ) : null}
      </div>

      {/* ============================================================
          ACTION FOOTER

          Important:
          - Hard-Fixed is no longer here.
          - Both actions have equal available width.
          - "Move" is deliberately short for narrow laptop cards.
          ============================================================ */}

      <div className="mt-auto border-t border-border-soft/80 pt-2.5">
        <div className="grid w-full grid-cols-2 gap-1">
          {/* ========================================================
              MOVE
              ======================================================== */}

          <div className="min-w-0 overflow-hidden">
            <Dialog
              open={isOpen}
              onOpenChange={setIsOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  title="Move or edit session"
                  className="
                    h-7
                    min-h-7
                    xl:min-h-7
                    2xl:min-h-7
                    w-full
                    min-w-0
                    rounded-md
                    border-primary/20
                    bg-white
                    px-1.5
                    xl:px-1.5
                    2xl:px-1.5
                    py-0
                    xl:py-0
                    gap-1
                    xl:gap-1
                    text-[10px]
                    xl:text-[10px]
                    2xl:text-[10px]
                    font-bold
                    text-primary
                    transition-colors
                    hover:border-primary/40
                    hover:bg-primary-soft
                  "
                  leadingIcon={
                    <Settings className="size-2.5 shrink-0" />
                  }
                >
                  <span className="truncate">
                    Move
                  </span>
                </Button>
              </DialogTrigger>

              {/* ====================================================
                  EDITOR DIALOG
                  ==================================================== */}

              {isOpen ? (
                <DialogContent
                  className="
                    flex
                    max-h-[calc(100dvh-2rem)]
                    max-w-md
                    flex-col
                    overflow-hidden
                    p-0
                  "
                >
                  <DialogHeader
                    className="
                      shrink-0
                      border-b
                      border-border
                      px-5
                      py-3.5
                      pr-12
                    "
                  >
                    <DialogTitle className="text-base font-bold text-text-primary">
                      Move or Edit Session
                    </DialogTitle>

                    <DialogDescription className="sr-only">
                      Change the day, session time, trainer,
                      room or notes for this timetable
                      session.
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    action={action}
                    className="
                      flex
                      min-h-0
                      flex-1
                      flex-col
                      overflow-hidden
                    "
                  >
                    {/* Hidden values */}
                    <input
                      type="hidden"
                      name="sessionId"
                      value={session.id}
                    />

                    <input
                      type="hidden"
                      name="originalWorkingDayId"
                      value={session.workingDayId}
                    />

                    <input
                      type="hidden"
                      name="originalStartTimeSlotId"
                      value={session.startTimeSlotId}
                    />

                    <input
                      type="hidden"
                      name="originalEndTimeSlotId"
                      value={session.endTimeSlotId}
                    />

                    <input
                      type="hidden"
                      name="originalTrainerId"
                      value={session.trainerId ?? ''}
                    />

                    <input
                      type="hidden"
                      name="originalNotes"
                      value={
                        session.notes ===
                        'Generated by the institutional timetabler.'
                          ? ''
                          : (session.notes ?? '')
                      }
                    />

                    <DialogBody
                      className="
                        min-h-0
                        flex-1
                        space-y-5
                        overflow-y-auto
                        px-5
                        py-4
                      "
                    >
                      {/* ==================================================
                          SESSION SUMMARY
                          ================================================== */}

                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          rounded-xl
                          border
                          border-border-soft
                          bg-surface-subtle/30
                          px-3
                          py-2.5
                          text-xs
                        "
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="
                              inline-flex
                              shrink-0
                              items-center
                              rounded-md
                              border
                              border-primary/20
                              bg-primary-soft/50
                              px-2
                              py-0.5
                              text-[10px]
                              font-bold
                              text-primary
                            "
                          >
                            {session.unitCode}
                          </span>

                          <span
                            className="
                              truncate
                              font-bold
                              text-text-primary
                            "
                            title={session.unitName}
                          >
                            {session.unitName}
                          </span>
                        </div>

                        <div
                          className="
                            flex
                            shrink-0
                            items-center
                            gap-1.5
                            text-[10px]
                            font-medium
                            text-text-muted
                          "
                        >
                          <span>
                            {session.cohortCode}
                          </span>

                          <span>·</span>

                          <span>
                            {formatTrainerAbbreviation(
                              session.trainerName ||
                                'Unassigned',
                            )}
                          </span>
                        </div>
                      </div>

                      {/* ==================================================
                          SCHEDULE
                          ================================================== */}

                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="
                              shrink-0
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-[0.08em]
                              text-text-secondary
                            "
                          >
                            Schedule
                          </span>

                          <div className="h-px flex-1 bg-border-soft" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Day */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Day
                            </label>

                            <Select
                              name="workingDayId"
                              defaultValue={
                                session.workingDayId
                              }
                              aria-label="Working day"
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
                          </div>

                          {/* Session */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Session
                            </label>

                            <Select
                              name="timeSlotId"
                              defaultValue={
                                session.startTimeSlotId
                              }
                              aria-label="Time slot"
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
                          </div>
                        </div>
                      </section>

                      {/* ==================================================
                          ASSIGNMENT
                          ================================================== */}

                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="
                              shrink-0
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-[0.08em]
                              text-text-secondary
                            "
                          >
                            Assignment
                          </span>

                          <div className="h-px flex-1 bg-border-soft" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Trainer */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Trainer
                            </label>

                            <Select
                              name="trainerId"
                              defaultValue={
                                session.trainerId ?? ''
                              }
                              aria-label="Trainer"
                              className="w-full"
                            >
                              <option value="">
                                Unassigned
                              </option>

                              {data.trainers.map(
                                (trainer) => {
                                  const isGuest =
                                    data.profile &&
                                    trainer.departmentId !==
                                      data.profile
                                        .activeDepartmentId;

                                  const workloadLabel =
                                    isGuest
                                      ? `Guest · ${trainer.allocatedHours}h`
                                      : `${trainer.allocatedHours}h`;

                                  return (
                                    <option
                                      key={trainer.id}
                                      value={trainer.id}
                                    >
                                      {trainer.fullName} (
                                      {workloadLabel})
                                    </option>
                                  );
                                },
                              )}
                            </Select>
                          </div>

                          {/* Room */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Room
                            </label>

                            <Select
                              name="roomId"
                              defaultValue={
                                session.roomId ?? ''
                              }
                              aria-label="Room"
                              className="w-full"
                            >
                              <option value="">
                                No room
                              </option>

                              {data.rooms.map((room) => {
                                const isUnderCapacity =
                                  room.capacity > 0 &&
                                  session.cohortSize > 0 &&
                                  room.capacity <
                                    session.cohortSize;

                                return (
                                  <option
                                    key={room.id}
                                    value={room.id}
                                  >
                                    {room.label}
                                    {room.capacity > 0
                                      ? ` (${room.capacity} cap)`
                                      : ''}
                                    {isUnderCapacity
                                      ? ' ⚠️'
                                      : ''}
                                  </option>
                                );
                              })}
                            </Select>
                          </div>
                        </div>
                      </section>

                      {/* ==================================================
                          NOTE
                          ================================================== */}

                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="
                              shrink-0
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-[0.08em]
                              text-text-secondary
                            "
                          >
                            Note
                          </span>

                          <div className="h-px flex-1 bg-border-soft" />
                        </div>

                        <input
                          name="notes"
                          defaultValue={
                            session.notes ===
                            'Generated by the institutional timetabler.'
                              ? ''
                              : (session.notes ?? '')
                          }
                          placeholder="e.g., Clinical rotation swap"
                          className="
                            h-9
                            w-full
                            rounded-xl
                            border
                            border-border-strong
                            bg-surface
                            px-3
                            text-sm
                            outline-none
                            placeholder:text-text-muted
                            focus:border-primary
                          "
                        />
                      </section>

                      {/* Status */}
                      {state.message ? (
                        <FormStatusMessage
                          status={
                            state.status === 'success'
                              ? 'success'
                              : 'error'
                          }
                          message={state.message}
                        />
                      ) : null}
                    </DialogBody>

                    {/* ==================================================
                        DIALOG FOOTER
                        ================================================== */}

                    <DialogFooter
                      className="
                        flex
                        shrink-0
                        items-center
                        justify-between
                        gap-2
                        border-t
                        border-border
                        bg-surface
                        px-5
                        py-3
                      "
                    >
                      <Button
                        type="submit"
                        formAction={
                          unscheduleSessionAction
                        }
                        variant="ghost"
                        size="sm"
                        className="
                          text-xs
                          text-danger
                          hover:bg-danger-surface
                          hover:text-danger
                        "
                        leadingIcon={
                          <Trash2 className="size-3.5" />
                        }
                      >
                        Unschedule
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setIsOpen(false)
                          }
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
                          {pending
                            ? 'Saving...'
                            : 'Save Changes'}
                        </Button>
                      </div>
                    </DialogFooter>
                  </form>
                </DialogContent>
              ) : null}
            </Dialog>
          </div>

          {/* ========================================================
              QUICK EDIT

              The wrapper deliberately constrains whatever button
              QuickEditPanel renders.
              ======================================================== */}

          <div
            className="
              min-w-0
              overflow-hidden

              [&_button]:h-7
              [&_button]:min-h-7
              [&_button]:xl:min-h-7
              [&_button]:2xl:min-h-7
              [&_button]:w-full
              [&_button]:min-w-0
              [&_button]:max-w-full
              [&_button]:overflow-hidden
              [&_button]:rounded-md
              [&_button]:px-1.5
              [&_button]:xl:px-1.5
              [&_button]:2xl:px-1.5
              [&_button]:py-0
              [&_button]:xl:py-0
              [&_button]:gap-1
              [&_button]:xl:gap-1
              [&_button]:text-[10px]
              [&_button]:xl:text-[10px]
              [&_button]:2xl:text-[10px]
              [&_button]:whitespace-nowrap
            "
          >
            <QuickEditPanel
              session={session}
              data={data}
            />
          </div>
        </div>
      </div>
    </article>
  );
}