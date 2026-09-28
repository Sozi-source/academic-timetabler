import Link from 'next/link';

import {
  AlertTriangle,
  GitMerge,
  History,
  Lock,
  LockOpen,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  bulkLockTimetableSessionsAction,
  combineMatchingUnitsAction,
  undoLastTimetableEditAction,
} from './actions';

import { ScheduleAllocationDialog } from './schedule-allocation-dialog';

import { SessionEditorCard } from './session-editor-card';

import type {
  EditorData,
  EditorSession,
} from './types';

/* ================================================================
   SESSION PERIODS
   ================================================================ */

type SessionPeriod =
  | 'Morning'
  | 'Mid-morning'
  | 'Afternoon';

const SESSION_PERIODS: SessionPeriod[] = [
  'Morning',
  'Mid-morning',
  'Afternoon',
];

/* ================================================================
   SESSION PERIOD DETECTION
   ================================================================ */

/**
 * Determines which academic period a session belongs to.
 *
 * Morning:
 *     before 10:30
 *
 * Mid-morning:
 *     10:30–13:59
 *
 * Afternoon:
 *     14:00 onwards
 *
 * The actual configured slot start time is used rather than
 * relying on array position.
 */
function getSessionPeriod(
  session: EditorSession,
  timeSlots: EditorData['timeSlots'],
): SessionPeriod {
  const slot = timeSlots.find(
    (item) => item.id === session.startTimeSlotId,
  );

  if (!slot) {
    return 'Morning';
  }

  const time = slot.startsAt.slice(0, 5);

  const [hours, minutes] = time
    .split(':')
    .map(Number);

  const totalMinutes =
    hours * 60 + minutes;

  if (totalMinutes < 10 * 60 + 30) {
    return 'Morning';
  }

  if (totalMinutes < 14 * 60) {
    return 'Mid-morning';
  }

  return 'Afternoon';
}

/* ================================================================
   PERIOD SECTION
   ================================================================ */

function SessionPeriodSection({
  period,
  sessions,
  data,
}: {
  period: SessionPeriod;
  sessions: EditorSession[];
  data: EditorData;
}) {
  /*
   * Do not render empty period headings.
   *
   * This keeps the timetable compact when, for example,
   * there are no afternoon sessions on Monday.
   */
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2.5">
      {/* ==========================================================
          PERIOD HEADER
          ========================================================== */}

      <div className="flex items-center gap-2 px-1">
        <span
          className="
            shrink-0
            text-[9px]
            font-bold
            uppercase
            tracking-[0.08em]
            text-text-secondary
          "
        >
          {period}
        </span>

        <div className="h-px flex-1 bg-border-soft" />

        <span
          className="
            shrink-0
            rounded-full
            bg-surface
            px-1.5
            py-0.5
            text-[9px]
            font-medium
            text-text-muted
          "
        >
          {sessions.length}
        </span>
      </div>

      {/* ==========================================================
          PERIOD SESSIONS
          ========================================================== */}

      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionEditorCard
            key={session.id}
            session={session}
            data={data}
          />
        ))}
      </div>
    </section>
  );
}

/* ================================================================
   MAIN WORKSPACE
   ================================================================ */

export function TimetableEditorWorkspace({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: EditorData;
}) {
  /* ==============================================================
     GLOBAL COUNTS
     ============================================================== */

  const lockedCount = data.sessions.filter(
    (session) => session.isLocked,
  ).length;

  const totalCount = data.sessions.length;

  const allLocked =
    totalCount > 0 &&
    lockedCount === totalCount;

  return (
    <div className="space-y-5">
      {/* ==========================================================
          WORKSPACE HEADER
          ========================================================== */}

      <div
        className="
          flex
          flex-wrap
          items-center
          justify-between
          gap-3
          rounded-xl
          border
          border-border
          bg-surface
          px-4
          py-2.5
          shadow-xs
        "
      >
        {/* Left: Summary Metrics */}
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold tracking-tight text-text-primary">
            {totalCount} Sessions
          </span>

          <span className="text-border-strong select-none">·</span>

          <span
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-md
              bg-primary-soft/70
              px-2
              py-0.5
              text-xs
              font-bold
              text-primary
            "
          >
            <Lock className="size-3" />
            {lockedCount} Hard-Fixed
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lock / unlock all */}
          {totalCount > 0 ? (
            <form action={bulkLockTimetableSessionsAction}>
              <input
                type="hidden"
                name="academicPeriodId"
                value={academicPeriodId}
              />

              <input
                type="hidden"
                name="lock"
                value={
                  allLocked
                    ? 'false'
                    : 'true'
                }
              />

              <Button
                type="submit"
                variant={
                  allLocked
                    ? 'outline'
                    : 'primary'
                }
                size="sm"
                leadingIcon={
                  allLocked ? (
                    <LockOpen className="size-3.5" />
                  ) : (
                    <Lock className="size-3.5" />
                  )
                }
              >
                {allLocked
                  ? 'Unlock All'
                  : 'Lock All'}
              </Button>
            </form>
          ) : null}

          {/* Undo */}
          <form action={undoLastTimetableEditAction}>
            <input
              type="hidden"
              name="academicPeriodId"
              value={academicPeriodId}
            />

            <Button
              type="submit"
              variant="outline"
              size="sm"
              leadingIcon={
                <History className="size-3.5" />
              }
            >
              Undo
            </Button>
          </form>

          {/* Generator */}
          <Button
            asChild
            variant="outline"
            size="sm"
            leadingIcon={
              <ShieldCheck className="size-3.5" />
            }
          >
            <Link
              href={`/timetable/generator?academicPeriodId=${academicPeriodId}`}
            >
              Generator
            </Link>
          </Button>
        </div>
      </div>

      {/* ==========================================================
          MISSING ALLOCATIONS
          ========================================================== */}

      {data.missingAllocations.length > 0 ? (
        <section
          className="
            rounded-2xl
            border
            border-warning/30
            bg-warning-surface
            p-4
          "
        >
          {/* Heading */}
          <div
            className="
              flex
              flex-wrap
              items-start
              justify-between
              gap-3
            "
          >
            <div className="min-w-0">
              <h2
                className="
                  flex
                  items-center
                  gap-2
                  font-semibold
                  text-text-primary
                "
              >
                <AlertTriangle className="size-4 text-warning" />

                Units missing from timetable (
                {data.missingAllocations.length})
              </h2>

              <p className="mt-1 text-xs text-text-muted">
                These allocations are not yet placed on the
                grid. Click{' '}
                <strong>Place on Timetable</strong> to assign
                their Day, Slot, and Room directly from your
                physical master timetable.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Combine */}
              <form action={combineMatchingUnitsAction}>
                <input
                  type="hidden"
                  name="academicPeriodId"
                  value={academicPeriodId}
                />

                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  leadingIcon={
                    <GitMerge className="size-3.5" />
                  }
                  title="
                    Combines unallocated units across cohorts
                    that share a canonical title — an
                    HOD-approved equivalence or an
                    exact-normalized title — into one shared
                    class.
                  "
                >
                  Combine matching units
                </Button>
              </form>

              {/* Diagnosis */}
              <Link
                href="/timetable/generator"
                className="
                  text-xs
                  font-semibold
                  text-primary
                  hover:underline
                "
              >
                Review generator diagnosis
              </Link>
            </div>
          </div>

          {/* Missing allocations */}
          <div
            className="
              mt-3.5
              grid
              gap-3
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-4
            "
          >
            {data.missingAllocations.map(
              (allocation) => (
                <div
                  key={allocation.id}
                  className="
                    flex
                    flex-col
                    justify-between
                    rounded-xl
                    border
                    border-warning/30
                    bg-surface
                    p-3.5
                    text-sm
                    shadow-sm
                    transition-colors
                    hover:border-warning/50
                  "
                >
                  <div>
                    {/* Code + cohort */}
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-1
                      "
                    >
                      <span className="text-xs font-bold text-primary">
                        {allocation.unitCode}
                      </span>

                      <div className="flex items-center gap-1">
                        {allocation.isSharedClass ? (
                          <span
                            className="
                              rounded
                              border
                              border-primary/20
                              bg-primary-soft/50
                              px-1.5
                              py-0.5
                              text-[9px]
                              font-bold
                              text-primary
                            "
                            title={`Shared with ${allocation.participantCohortCodes.join(
                              ', ',
                            )}`}
                          >
                            Shared
                          </span>
                        ) : null}

                        <span
                          className="
                            rounded
                            border
                            border-border-soft
                            bg-surface-subtle
                            px-1.5
                            py-0.5
                            text-[10px]
                            font-semibold
                            text-text-muted
                          "
                        >
                          {allocation.cohortCode}
                        </span>
                      </div>
                    </div>

                    {/* Unit */}
                    <p
                      className="
                        mt-1.5
                        line-clamp-2
                        text-xs
                        font-bold
                        leading-snug
                        text-text-primary
                      "
                      title={allocation.unitName}
                    >
                      {allocation.unitName}
                    </p>

                    {/* Trainer */}
                    <p className="mt-1 text-xs text-text-muted">
                      {allocation.trainerName}
                    </p>

                    {/* Missing */}
                    <p className="mt-2 text-xs font-bold text-warning">
                      {allocation.missingSessionCount} of{' '}
                      {allocation.expectedSessionCount}{' '}
                      session
                      {allocation.expectedSessionCount ===
                      1
                        ? ''
                        : 's'}{' '}
                      missing
                    </p>
                  </div>

                  <ScheduleAllocationDialog
                    allocation={allocation}
                    data={data}
                  />
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {/* ==========================================================
          TIMETABLE
          ========================================================== */}

      <div className="overflow-x-auto pb-4">
        <div
          className="
            grid
            min-w-[1050px]
            grid-cols-1
            gap-4
            sm:grid-cols-2
            md:grid-cols-3
            xl:grid-cols-5
          "
        >
          {data.workingDays.map((day) => {
            /* ======================================================
               DAY SESSIONS
               ====================================================== */

            const sessions = data.sessions
              .filter(
                (session) =>
                  session.workingDayId ===
                  day.id,
              )
              .sort((a, b) => {
                const slotA =
                  data.timeSlots.find(
                    (slot) =>
                      slot.id ===
                      a.startTimeSlotId,
                  );

                const slotB =
                  data.timeSlots.find(
                    (slot) =>
                      slot.id ===
                      b.startTimeSlotId,
                  );

                return (
                  (slotA?.sequenceNumber ?? 0) -
                  (slotB?.sequenceNumber ?? 0)
                );
              });

            /* ======================================================
               DAY LOCKED COUNT
               ====================================================== */

            const dayLockedCount =
              sessions.filter(
                (session) =>
                  session.isLocked,
              ).length;

            /* ======================================================
               PERIOD GROUPING
               ====================================================== */

            const sessionsByPeriod: Record<
              SessionPeriod,
              EditorSession[]
            > = {
              Morning: [],
              'Mid-morning': [],
              Afternoon: [],
            };

            for (const session of sessions) {
              const period =
                getSessionPeriod(
                  session,
                  data.timeSlots,
                );

              sessionsByPeriod[
                period
              ].push(session);
            }

            /* ======================================================
               DAY COLUMN
               ====================================================== */

            return (
              <section
                key={day.id}
                className="
                  min-w-[200px]
                  rounded-2xl
                  border
                  border-border
                  border-t-4
                  border-t-institutional-yellow
                  bg-surface-subtle
                  p-3
                  shadow-sm
                "
              >
                {/* ==================================================
                    DAY HEADER
                    ================================================== */}

                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">
                    {day.label}
                  </h2>

                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    {/* Total */}
                    <span
                      className="
                        rounded-full
                        bg-surface
                        px-2
                        py-0.5
                        font-medium
                      "
                    >
                      {sessions.length}
                    </span>

                    {/* Locked */}
                    {dayLockedCount > 0 ? (
                      <span
                        className="
                          flex
                          items-center
                          gap-0.5
                          text-[10px]
                          font-semibold
                          text-primary
                        "
                        title={`${dayLockedCount} locked`}
                      >
                        <Lock className="size-2.5" />

                        {dayLockedCount}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* ==================================================
                    PERIODS
                    ================================================== */}

                {sessions.length > 0 ? (
                  <div className="space-y-5">
                    {SESSION_PERIODS.map(
                      (period) => (
                        <SessionPeriodSection
                          key={period}
                          period={period}
                          sessions={
                            sessionsByPeriod[
                              period
                            ]
                          }
                          data={data}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <p
                    className="
                      rounded-xl
                      border
                      border-dashed
                      border-border
                      px-3
                      py-8
                      text-center
                      text-xs
                      text-text-muted
                    "
                  >
                    No sessions
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}