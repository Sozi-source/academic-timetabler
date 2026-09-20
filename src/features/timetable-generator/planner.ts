import {
  detectTimetableConflicts,
} from './conflict-detector';
import {
  createPlacementCandidates,
} from './candidate-factory';
import {
  scorePlacement,
  scorePlacements,
  type PlacementScoreResult,
} from './scorer';
import {
  suggestAlternativePlacements,
} from './suggestions';
import {
  getIntervalDurationMinutes,
  parseTimeToMinutes,
} from './time';
import type {
  PlanningAllocation,
  PlanningCohort,
  PlanningConstraint,
  PlanningResult,
  PlanningRoom,
  PlanningSession,
  PlanningStatistics,
  PlanningSuggestion,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningUnit,
  PlanningWorkingDay,
} from './types';

export interface AutomaticPlannerOptions {
  allowSameAllocationMultipleSessionsPerDay?: boolean;
  candidateLimitPerRequest?: number;
}

export interface UnscheduledPlanningSession {
  teachingAllocationId: string;
  sessionNumber: number;
  reason:
    | 'allocation_disabled'
    | 'missing_relationship'
    | 'no_working_days'
    | 'no_time_range'
    | 'no_rooms'
    | 'no_valid_placement';
  message: string;
  attemptedCandidateCount: number;
  conflictTypes: string[];
  blockers: UnscheduledPlacementBlocker[];
}

export interface UnscheduledPlacementBlocker {
  type: string;
  cause: string;
  suggestion: string;
  rejectedCandidateCount: number;
  candidateWindows: string[];
}

export interface AutomaticPlannerInput {
  academicPeriodId: string;
  activeDepartmentId?: string | null;
  allocations: PlanningAllocation[];
  existingSessions?: PlanningSession[];
  previousSessions?: PlanningSession[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  constraints?: PlanningConstraint[];
  trainers: PlanningTrainer[];
  trainerUnitEligibility?: Array<{
    trainerId: string;
    unitId: string;
  }>;
  cohorts: PlanningCohort[];
  rooms: PlanningRoom[];
  units: PlanningUnit[];
  options?: AutomaticPlannerOptions;
}

export interface AutomaticPlannerResult
  extends PlanningResult {
  unscheduled: UnscheduledPlanningSession[];
}

interface SessionRequest {
  allocation: PlanningAllocation;
  sessionNumber: number;
  constraintPriority: number;
  difficultyScore: number;
}

interface TimeSlotRange {
  startTimeSlotId: string;
  endTimeSlotId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}

function buildLookup<T extends {
  id: string;
}>(
  values: T[],
): Map<string, T> {
  return new Map(
    values.map((value) => [
      value.id,
      value,
    ]),
  );
}

function isActiveSession(
  session: PlanningSession,
) {
  return ![
    'cancelled',
    'archived',
  ].includes(session.status);
}

function sessionSatisfiesRequest({
  session,
  allocation,
  sessionNumber,
}: {
  session: PlanningSession;
  allocation: PlanningAllocation;
  sessionNumber: number;
}) {
  if (
    session.teachingAllocationId !== allocation.id ||
    session.sessionNumber !== sessionNumber ||
    session.academicPeriodId !== allocation.academicPeriodId ||
    session.cohortId !== allocation.cohortId ||
    session.unitId !== allocation.unitId ||
    session.trainerId !== allocation.trainerId ||
    (allocation.preferredRoomId !== null &&
      session.roomId !== allocation.preferredRoomId)
  ) {
    return false;
  }

  const fixedTimeSlotId =
    allocation.fixedTimeSlotIds?.[sessionNumber - 1] ?? null;

  const fixedWorkingDayId =
    allocation.fixedWorkingDayIds?.[sessionNumber - 1] ??
    (sessionNumber === 1 || fixedTimeSlotId ? allocation.fixedWorkingDayId : null) ??
    null;

  if (!fixedTimeSlotId && !fixedWorkingDayId) {
    return true;
  }

  if (!fixedTimeSlotId) {
    // Day-only pin: no specific time slot required, but the session
    // must fall on the pinned working day.
    return session.workingDayId === fixedWorkingDayId;
  }

  return (
    session.startTimeSlotId === fixedTimeSlotId &&
    (!fixedWorkingDayId || session.workingDayId === fixedWorkingDayId) &&
    (!allocation.isFullDaySession ||
      !allocation.fixedEndTimeSlotId ||
      session.endTimeSlotId === allocation.fixedEndTimeSlotId)
  );
}

function createGeneratedSessionId({
  allocationId,
  sessionNumber,
}: {
  allocationId: string;
  sessionNumber: number;
}) {
  return [
    'generated',
    allocationId,
    sessionNumber,
  ].join(':');
}

function createCandidateId({
  allocationId,
  sessionNumber,
  workingDayId,
  startTimeSlotId,
  endTimeSlotId,
  roomId,
}: {
  allocationId: string;
  sessionNumber: number;
  workingDayId: string;
  startTimeSlotId: string;
  endTimeSlotId: string;
  roomId: string | null;
}) {
  return [
    'candidate',
    allocationId,
    sessionNumber,
    workingDayId,
    startTimeSlotId,
    endTimeSlotId,
    roomId ?? 'unassigned-room',
  ].join(':');
}

function buildContiguousTimeRanges({
  timeSlots,
  durationMinutes,
}: {
  timeSlots: PlanningTimeSlot[];
  durationMinutes: number;
}): TimeSlotRange[] {
  const orderedSlots = [...timeSlots].sort(
    (first, second) =>
      first.sequenceNumber -
        second.sequenceNumber ||
      parseTimeToMinutes(
        first.startsAt,
      ) -
        parseTimeToMinutes(
          second.startsAt,
        ) ||
      first.id.localeCompare(
        second.id,
      ),
  );

  const ranges: TimeSlotRange[] = [];

  for (
    let startIndex = 0;
    startIndex < orderedSlots.length;
    startIndex += 1
  ) {
    const startSlot =
      orderedSlots[startIndex];

    let previousSlot =
      startSlot;

    for (
      let endIndex = startIndex;
      endIndex < orderedSlots.length;
      endIndex += 1
    ) {
      const endSlot =
        orderedSlots[endIndex];

      if (
        endIndex > startIndex &&
        (
          previousSlot.sequenceNumber +
            1 !==
            endSlot.sequenceNumber ||
          parseTimeToMinutes(
            previousSlot.endsAt,
          ) !==
            parseTimeToMinutes(
              endSlot.startsAt,
            )
        )
      ) {
        break;
      }

      const rangeDuration =
        getIntervalDurationMinutes({
          startsAt:
            startSlot.startsAt,
          endsAt:
            endSlot.endsAt,
        });

      if (
        rangeDuration ===
        durationMinutes
      ) {
        ranges.push({
          startTimeSlotId:
            startSlot.id,
          endTimeSlotId:
            endSlot.id,
          startsAt:
            startSlot.startsAt,
          endsAt:
            endSlot.endsAt,
          durationMinutes:
            rangeDuration,
        });

        break;
      }

      if (
        rangeDuration >
        durationMinutes
      ) {
        break;
      }

      previousSlot = endSlot;
    }
  }

  return ranges;
}

function buildFullDayTimeRange({
  timeSlots,
  startTimeSlotId,
  endTimeSlotId,
  durationMinutes,
}: {
  timeSlots: PlanningTimeSlot[];
  startTimeSlotId: string | null | undefined;
  endTimeSlotId: string | null | undefined;
  durationMinutes: number;
}): TimeSlotRange[] {
  const teachingSlots = timeSlots
    .filter((slot) => slot.isEnabled && slot.slotType === 'teaching')
    .sort((first, second) => first.sequenceNumber - second.sequenceNumber);

  if (teachingSlots.length === 0) {
    return [];
  }

  const startSlot = startTimeSlotId
    ? timeSlots.find((slot) => slot.id === startTimeSlotId) ?? teachingSlots[0]
    : teachingSlots[0];

  const endSlot = endTimeSlotId
    ? timeSlots.find((slot) => slot.id === endTimeSlotId) ?? teachingSlots[teachingSlots.length - 1]
    : teachingSlots[teachingSlots.length - 1];

  if (
    !startSlot ||
    !endSlot ||
    endSlot.sequenceNumber < startSlot.sequenceNumber
  ) {
    return [];
  }

  const rangeDuration =
    getIntervalDurationMinutes({
      startsAt: startSlot.startsAt,
      endsAt: endSlot.endsAt,
    });

  return [
    {
      startTimeSlotId: startSlot.id,
      endTimeSlotId: endSlot.id,
      startsAt: startSlot.startsAt,
      endsAt: endSlot.endsAt,
      durationMinutes: rangeDuration,
    },
  ];
}

function countEligibleRooms({
  allocation,
  cohort,
  unit,
  rooms,
}: {
  allocation: PlanningAllocation;
  cohort?: PlanningCohort;
  unit?: PlanningUnit;
  rooms: PlanningRoom[];
}) {
  if (!allocation.preferredRoomId) {
    return 1;
  }

  return rooms.filter((room) => {
    if (
      !room.isActive ||
      !room.isTimetableAvailable
    ) {
      return false;
    }

    if (
      cohort &&
      (allocation.combinedCohortSize ?? cohort.actualSize) > 0 &&
      room.capacity <
        (allocation.combinedCohortSize ?? cohort.actualSize)
    ) {
      return false;
    }

    if (
      unit?.preferredRoomType &&
      room.roomType !==
        unit.preferredRoomType
    ) {
      return false;
    }

    if (
      allocation.preferredRoomId &&
      room.id !==
        allocation.preferredRoomId
    ) {
      return false;
    }

    return true;
  }).length;
}

function calculateDifficultyScore({
  allocation,
  cohort,
  unit,
  trainer,
  activeDepartmentId,
  eligibleRoomCount,
}: {
  allocation: PlanningAllocation;
  cohort?: PlanningCohort;
  unit?: PlanningUnit;
  trainer?: PlanningTrainer;
  activeDepartmentId?: string | null;
  eligibleRoomCount: number;
}) {
  let score = 0;

  score +=
    allocation.sessionDurationMinutes;

  score +=
    allocation.weeklySessions * 20;

  const participantCohortCount = Math.max(
    1,
    allocation.participantCohortIds?.length ?? 0,
  );

  // Shared classes combining multiple cohorts are exponentially harder to place
  if (participantCohortCount > 1) {
    score += participantCohortCount * 400;
  }

  score +=
    allocation.combinedCohortSize ?? cohort?.actualSize ?? 0;

  const isOtherDepartmentTrainer = Boolean(
    trainer &&
    trainer.departmentId &&
    activeDepartmentId &&
    trainer.departmentId !== activeDepartmentId,
  );

  if (isOtherDepartmentTrainer) {
    score += 500;
  }

  if (trainer?.availabilityMode === 'selected_slots_only') {
    score += 400;
    const slotCount = trainer.availableSlots?.length ?? 0;
    score += Math.max(0, 30 - slotCount) * 20;
  } else if (trainer?.availableSlots && trainer.availableSlots.length > 0) {
    const slotCount = trainer.availableSlots.length;
    score += Math.max(0, 20 - slotCount) * 10;
  }

  if (allocation.fixedTimeSlotIds && allocation.fixedTimeSlotIds.length > 0) {
    score += 250;
  }
  if (allocation.fixedWorkingDayId || (allocation.fixedWorkingDayIds && allocation.fixedWorkingDayIds.length > 0)) {
    score += 250;
  }

  if (
    allocation.preferredRoomId
  ) {
    score += 150;
  }

  if (unit?.preferredRoomType) {
    score += 100;
  }

  if (eligibleRoomCount === 1) {
    score += 200;
  }
  else if (
    eligibleRoomCount === 2
  ) {
    score += 100;
  }
  else if (
    eligibleRoomCount === 0
  ) {
    score += 500;
  }

  return score;
}

function calculateConstraintPriority({
  allocation,
  sessionNumber,
  trainer,
  activeDepartmentId,
}: {
  allocation: PlanningAllocation;
  sessionNumber: number;
  trainer?: PlanningTrainer;
  activeDepartmentId?: string | null;
}) {
  const fixedTimeSlotId =
    allocation.fixedTimeSlotIds?.[
      sessionNumber - 1
    ];

  const fixedWorkingDayId =
    allocation.fixedWorkingDayIds?.[
      sessionNumber - 1
    ] ?? allocation.fixedWorkingDayId;

  const hasFixedTimeAndDay = Boolean(
    fixedTimeSlotId &&
    fixedWorkingDayId,
  );

  const isFullDay = Boolean(
    allocation.isFullDaySession &&
    hasFixedTimeAndDay,
  );

  const isOtherDepartmentTrainer = Boolean(
    trainer &&
    trainer.departmentId &&
    activeDepartmentId &&
    trainer.departmentId !== activeDepartmentId,
  );

  const isSelectedSlotsOnly = trainer?.availabilityMode === 'selected_slots_only';
  const hasRestrictedAvailability = isSelectedSlotsOnly || Boolean(
    trainer?.availableSlots &&
    trainer.availableSlots.length > 0 &&
    trainer.availableSlots.length <= 15,
  );

  const participantCohortCount = allocation.participantCohortIds?.length ?? 1;
  const isSharedClass = participantCohortCount >= 2;

  const isFlexibleFullDay = Boolean(
    allocation.isFullDaySession ||
    allocation.sessionDurationMinutes >= 480,
  );

  // Level 10: Fixed full-day sessions (08:00–16:00 on an exact day)
  if (isFullDay) {
    return 10;
  }

  // Level 9: Other department / guest trainer with exact fixed day and time slot
  if (isOtherDepartmentTrainer && hasFixedTimeAndDay) {
    return 9;
  }

  // Level 8: Internal trainer with exact fixed day and time slot
  if (hasFixedTimeAndDay) {
    return 8;
  }

  // Level 7: Multi-cohort full-day clinical rotations (>= 2 cohorts, 480m)
  // Must claim an empty day before individual 2-hour classes fragment all cohort weekdays
  if (isFlexibleFullDay && isSharedClass) {
    return 7;
  }

  // Level 6: Standalone full-day clinical rotations (480m)
  // Must claim an empty day before individual 2-hour classes fragment the single cohort's weekdays
  if (isFlexibleFullDay) {
    return 6;
  }

  // Level 5: Large multi-cohort shared classes (>= 4 cohorts, e.g. CND 1105, DHN 2302)
  if (participantCohortCount >= 4) {
    return 5;
  }

  // Level 4: Multi-cohort shared classes with 3 cohorts (e.g. DCU 1104 First Aid)
  if (participantCohortCount === 3) {
    return 4;
  }

  // Level 3: Multi-cohort shared classes with 2 cohorts (e.g. DHN 3205 Trade Project)
  if (participantCohortCount === 2) {
    return 3;
  }

  // Level 2: Other department / guest trainers or trainers with restricted available slots
  if (isOtherDepartmentTrainer || hasRestrictedAvailability) {
    return 2;
  }

  // Level 1: Partial fixed constraint (e.g. fixed day only or fixed slot only)
  if (fixedTimeSlotId || fixedWorkingDayId) {
    return 1;
  }

  return 0;
}

function createSessionRequests({
  allocations,
  cohorts,
  units,
  rooms,
  trainers = [],
  activeDepartmentId = null,
}: Pick<
  AutomaticPlannerInput,
  | 'allocations'
  | 'cohorts'
  | 'units'
  | 'rooms'
> & {
  trainers?: PlanningTrainer[];
  activeDepartmentId?: string | null;
}): SessionRequest[] {
  const cohortLookup =
    buildLookup(cohorts);

  const unitLookup =
    buildLookup(units);

  const trainerLookup =
    buildLookup(trainers);

  return allocations
    .filter(
      (allocation) =>
        allocation.isTimetableEnabled,
    )
    .flatMap((allocation) => {
      const cohort =
        cohortLookup.get(
          allocation.cohortId,
        );

      const unit =
        unitLookup.get(
          allocation.unitId,
        );

      const trainer = allocation.trainerId
        ? trainerLookup.get(allocation.trainerId)
        : undefined;

      const eligibleRoomCount =
        countEligibleRooms({
          allocation,
          cohort,
          unit,
          rooms,
        });

      const difficultyScore =
        calculateDifficultyScore({
          allocation,
          cohort,
          unit,
          trainer,
          activeDepartmentId,
          eligibleRoomCount,
        });

      return Array.from(
        {
          length:
            allocation.weeklySessions,
        },
        (_, index) => ({
          allocation,
          sessionNumber:
            index + 1,
          constraintPriority:
            calculateConstraintPriority({
              allocation,
              sessionNumber: index + 1,
              trainer,
              activeDepartmentId,
            }),
          difficultyScore,
        }),
      );
    })
    .sort(
      (first, second) =>
        second.constraintPriority -
          first.constraintPriority ||
        second.difficultyScore -
          first.difficultyScore ||
        first.allocation.id.localeCompare(
          second.allocation.id,
        ) ||
        first.sessionNumber -
          second.sessionNumber,
    );
}

function hasAllocationOnDay({
  sessions,
  allocationId,
  workingDayId,
}: {
  sessions: PlanningSession[];
  allocationId: string;
  workingDayId: string;
}) {
  return sessions.some(
    (session) =>
      isActiveSession(session) &&
      session.teachingAllocationId ===
        allocationId &&
      session.workingDayId ===
        workingDayId,
  );
}

function getEligibleRooms({
  allocation,
  rooms,
  cohort,
  unit,
}: {
  allocation: PlanningAllocation;
  rooms: PlanningRoom[];
  cohort?: PlanningCohort;
  unit?: PlanningUnit;
}): Array<PlanningRoom | null> {
  const availableRooms =
    rooms.filter(
      (room) =>
        room.isActive &&
        room.isTimetableAvailable,
    );

  if (
    !allocation.preferredRoomId
  ) {
    return [null];
  }

  const preferred = availableRooms.find(
    (room) => room.id === allocation.preferredRoomId,
  );

  if (!preferred) {
    return [null];
  }

  const requiredCapacity =
    allocation.combinedCohortSize ?? cohort?.actualSize ?? 0;

  if (requiredCapacity <= 0 || preferred.capacity >= requiredCapacity) {
    return [preferred];
  }

  const fittingRooms = availableRooms.filter(
    (room) =>
      room.capacity >= requiredCapacity &&
      (!unit?.preferredRoomType || room.roomType === unit.preferredRoomType),
  );

  if (fittingRooms.length > 0) {
    return [preferred, ...fittingRooms.filter((r) => r.id !== preferred.id)];
  }

  return [preferred];
}

function findPreviousSessionVenue({
  allocation,
  sessionNumber,
  workingDayId,
  startTimeSlotId,
  previousSessions,
  cohort,
  rooms,
}: {
  allocation: PlanningAllocation;
  sessionNumber: number;
  workingDayId: string;
  startTimeSlotId: string;
  previousSessions?: PlanningSession[];
  cohort?: PlanningCohort;
  rooms: PlanningRoom[];
}): PlanningRoom | null {
  if (!previousSessions || previousSessions.length === 0) {
    return null;
  }

  const matchingSlotSessions = previousSessions.filter(
    (s) =>
      s.workingDayId === workingDayId &&
      s.startTimeSlotId === startTimeSlotId &&
      s.roomId !== null,
  );

  if (matchingSlotSessions.length === 0) {
    return null;
  }

  // 1. Exact match on allocation and session number
  let matched = matchingSlotSessions.find(
    (s) =>
      s.teachingAllocationId === allocation.id &&
      s.sessionNumber === sessionNumber,
  );

  // 2. Match on same allocation at this day & slot
  if (!matched) {
    matched = matchingSlotSessions.find(
      (s) => s.teachingAllocationId === allocation.id,
    );
  }

  // 3. Fallback: match by cohort and unit at this day & slot
  if (!matched) {
    matched = matchingSlotSessions.find(
      (s) =>
        s.cohortId === allocation.cohortId &&
        s.unitId === allocation.unitId,
    );
  }

  if (!matched || !matched.roomId) {
    return null;
  }

  const room = rooms.find(
    (r) =>
      r.id === matched?.roomId &&
      r.isActive &&
      r.isTimetableAvailable,
  );

  if (!room) {
    return null;
  }

  const requiredCapacity =
    allocation.combinedCohortSize ?? cohort?.actualSize ?? 0;
  if (requiredCapacity > 0 && room.capacity < requiredCapacity) {
    return null;
  }

  return room;
}

function createCandidateSessions({
  request,
  workingDays,
  timeRanges,
  rooms,
  selectedSessions,
  allowSameAllocationMultipleSessionsPerDay,
  previousSessions,
  cohort,
  allRooms,
}: {
  request: SessionRequest;
  workingDays: PlanningWorkingDay[];
  timeRanges: TimeSlotRange[];
  rooms: Array<PlanningRoom | null>;
  selectedSessions: PlanningSession[];
  allowSameAllocationMultipleSessionsPerDay: boolean;
  previousSessions?: PlanningSession[];
  cohort?: PlanningCohort;
  allRooms?: PlanningRoom[];
}): PlanningSession[] {
  const {
    allocation,
    sessionNumber,
  } = request;

  const candidates:
  PlanningSession[] = [];

  const fixedTimeSlotIds =
    allocation.fixedTimeSlotIds ?? [];

  const fixedTimeSlotId =
    fixedTimeSlotIds[sessionNumber - 1] ?? null;

  const fixedWorkingDayIds =
    allocation.fixedWorkingDayIds ?? [];

  const fixedWorkingDayId =
    fixedWorkingDayIds[sessionNumber - 1] ??
    (sessionNumber === 1 || fixedTimeSlotId ? allocation.fixedWorkingDayId : null) ??
    null;

  const configuredFixedDays = fixedTimeSlotIds.map(
    (slotId, index) =>
      fixedWorkingDayIds[index] ??
      (index === 0 || slotId ? allocation.fixedWorkingDayId : null) ??
      null,
  );

  const isLinkedFixedSession =
    Boolean(fixedWorkingDayId && fixedTimeSlotId) &&
    fixedTimeSlotIds.length > 1 &&
    new Set(configuredFixedDays).size === 1;

  const linkedSession =
    isLinkedFixedSession
      ? selectedSessions.find(
          (session) =>
            isActiveSession(session) &&
            session.teachingAllocationId === allocation.id,
        )
      : undefined;

  const candidateRooms = linkedSession
    ? linkedSession.roomId
      ? rooms.filter(
          (room) => room?.id === linkedSession.roomId,
        )
      : [null]
    : rooms;

  for (const workingDay of workingDays) {
    if (
      fixedWorkingDayId &&
      workingDay.id !== fixedWorkingDayId
    ) {
      continue;
    }

    if (
      !allowSameAllocationMultipleSessionsPerDay &&
      !isLinkedFixedSession &&
      hasAllocationOnDay({
        sessions:
          selectedSessions,
        allocationId:
          allocation.id,
        workingDayId:
          workingDay.id,
      })
    ) {
      continue;
    }

    for (const range of timeRanges) {
      if (
        fixedTimeSlotId &&
        range.startTimeSlotId !== fixedTimeSlotId
      ) {
        continue;
      }

      const previousRoom = allRooms && previousSessions
        ? findPreviousSessionVenue({
            allocation,
            sessionNumber,
            workingDayId: workingDay.id,
            startTimeSlotId: range.startTimeSlotId,
            previousSessions,
            cohort,
            rooms: allRooms,
          })
        : null;

      const slotCandidateRooms = previousRoom
        ? [previousRoom, ...candidateRooms.filter((r) => r?.id !== previousRoom.id)]
        : candidateRooms;

      for (const room of slotCandidateRooms) {
        candidates.push({
          id: createCandidateId({
            allocationId:
              allocation.id,
            sessionNumber,
            workingDayId:
              workingDay.id,
            startTimeSlotId:
              range.startTimeSlotId,
            endTimeSlotId:
              range.endTimeSlotId,
            roomId: room?.id ?? null,
          }),
          academicPeriodId:
            allocation.academicPeriodId,
          teachingAllocationId:
            allocation.id,
          cohortId:
            allocation.cohortId,
          unitId:
            allocation.unitId,
          trainerId:
            allocation.trainerId,
          workingDayId:
            workingDay.id,
          startTimeSlotId:
            range.startTimeSlotId,
          endTimeSlotId:
            range.endTimeSlotId,
          roomId: room?.id ?? null,
          sessionNumber,
          deliveryMode:
            allocation.deliveryMode,
          status: 'draft',
          source: 'generator',
          conflictState:
            'unchecked',
          isLocked: false,
          participantCohortIds: allocation.participantCohortIds,
          combinedCohortSize: allocation.combinedCohortSize,
        });
      }
    }
  }

  return candidates;
}

function normalizeSelectedCandidate(
  candidate: PlanningSession,
) {
  return {
    ...candidate,
    id: createGeneratedSessionId({
      allocationId:
        candidate.teachingAllocationId,
      sessionNumber:
        candidate.sessionNumber,
    }),
    conflictState: 'clear' as const,
  };
}

interface RelocationRepairResult {
  placedSession: PlanningSession;
  relocatedSessions: PlanningSession[];
}

function tryRelocationRepair({
  request,
  candidateScores,
  selectedSessions,
  existingSessions,
  workingDays,
  timeSlots,
  rooms,
  trainers,
  cohorts,
  units,
  constraints,
  candidateLimit,
  allowSameDay,
  allocationLookup,
  previousSessions,
}: {
  request: SessionRequest;
  candidateScores: PlacementScoreResult[];
  selectedSessions: PlanningSession[];
  existingSessions: PlanningSession[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  rooms: PlanningRoom[];
  trainers: PlanningTrainer[];
  cohorts: PlanningCohort[];
  units: PlanningUnit[];
  constraints?: PlanningConstraint[];
  candidateLimit: number;
  allowSameDay: boolean;
  allocationLookup: Map<string, PlanningAllocation>;
  previousSessions?: PlanningSession[];
}): RelocationRepairResult | null {
  const selectedById = new Map(selectedSessions.map((s) => [s.id, s]));

  // Sort candidate placements by fewest blocked conflicts, then highest placement score
  const sortedCandidates = [...candidateScores]
    .filter((s) => !s.isValid)
    .sort((first, second) => {
      const firstBlocked = first.conflicts.filter((c) => c.severity === 'blocked').length;
      const secondBlocked = second.conflicts.filter((c) => c.severity === 'blocked').length;
      return firstBlocked - secondBlocked || second.score - first.score;
    })
    .slice(0, 15);

  for (const placementScore of sortedCandidates) {
    const blockedConflicts = placementScore.conflicts.filter((c) => c.severity === 'blocked');
    if (blockedConflicts.length === 0) continue;

    // Collect all conflicting session IDs (excluding candidate's own synthetic ID)
    const conflictingIds = new Set<string>();
    for (const conflict of blockedConflicts) {
      for (const id of conflict.sessionIds) {
        if (id !== placementScore.session.id) {
          conflictingIds.add(id);
        }
      }
    }

    // Attempt relocation for up to 2 (or up to 4 for multi-cohort shared units) blocking flexible sessions
    const maxDisplaceCount = Math.max(
      2,
      Math.min(4, request.allocation.participantCohortIds?.length ?? 1),
    );
    if (conflictingIds.size === 0 || conflictingIds.size > maxDisplaceCount) {
      continue;
    }

    const displacedSessions: PlanningSession[] = [];
    let canDisplace = true;

    for (const id of conflictingIds) {
      const session = selectedById.get(id);
      if (!session) {
        // Conflict is with existing / locked / external session, cannot be moved
        canDisplace = false;
        break;
      }

      if (session.isLocked || session.status === 'locked' || session.isExternal) {
        canDisplace = false;
        break;
      }

      // Check if this session has a user-fixed day and slot
      const alloc = allocationLookup.get(session.teachingAllocationId);
      const fixedSlot = alloc?.fixedTimeSlotIds?.[session.sessionNumber - 1];
      const fixedDay = alloc?.fixedWorkingDayIds?.[session.sessionNumber - 1] ?? alloc?.fixedWorkingDayId;
      if (fixedSlot && fixedDay) {
        canDisplace = false;
        break;
      }

      displacedSessions.push(session);
    }

    if (!canDisplace || displacedSessions.length === 0) {
      continue;
    }

    const displacedIds = new Set(displacedSessions.map((s) => s.id));
    const currentSessionsWithoutDisplaced = selectedSessions.filter((s) => !displacedIds.has(s.id));

    // Verify candidate is completely valid once displaced sessions are removed
    const testScore = scorePlacement({
      candidate: placementScore.session,
      existingSessions: [...existingSessions, ...currentSessionsWithoutDisplaced],
      workingDays,
      timeSlots,
      trainers,
      cohorts,
      rooms,
      units,
      constraints,
    });

    if (!testScore.isValid) {
      continue;
    }

    const normalizedPrimary = normalizeSelectedCandidate(placementScore.session);
    let activeSessionsForRelocation = [
      ...existingSessions,
      ...currentSessionsWithoutDisplaced,
      normalizedPrimary,
    ];

    const newlyRelocated: PlanningSession[] = [];
    let allDisplacedRelocated = true;

    // Try finding another valid time/room where both cohort and trainer are free
    for (const displaced of displacedSessions) {
      const alloc = allocationLookup.get(displaced.teachingAllocationId);
      if (!alloc) {
        allDisplacedRelocated = false;
        break;
      }

      const displacedCohort = cohorts.find((c) => c.id === alloc.cohortId);

      const displacedRequest: SessionRequest = {
        allocation: alloc,
        sessionNumber: displaced.sessionNumber,
        constraintPriority: 0,
        difficultyScore: 0,
      };

      const eligibleRooms = getEligibleRooms({
        allocation: alloc,
        rooms,
        cohort: displacedCohort,
      });

      if (eligibleRooms.length === 0) {
        allDisplacedRelocated = false;
        break;
      }

      const timeRanges = alloc.isFullDaySession
        ? buildFullDayTimeRange({
            timeSlots,
            startTimeSlotId: alloc.fixedTimeSlotIds?.[0],
            endTimeSlotId: alloc.fixedEndTimeSlotId,
            durationMinutes: alloc.sessionDurationMinutes,
          })
        : buildContiguousTimeRanges({
            timeSlots,
            durationMinutes: alloc.sessionDurationMinutes,
          });

      if (timeRanges.length === 0) {
        allDisplacedRelocated = false;
        break;
      }

      const candidateSessions = createCandidateSessions({
        request: displacedRequest,
        workingDays,
        timeRanges,
        rooms: eligibleRooms,
        selectedSessions: activeSessionsForRelocation,
        allowSameAllocationMultipleSessionsPerDay: allowSameDay,
        previousSessions,
        cohort: displacedCohort,
        allRooms: rooms,
      }).slice(0, Math.min(candidateLimit, 50));

      const relocationScores = scorePlacements({
        candidates: candidateSessions,
        existingSessions: activeSessionsForRelocation,
        workingDays,
        timeSlots,
        trainers,
        cohorts,
        rooms,
        units,
        constraints,
      });

      const bestRelocation = relocationScores.find((s) => s.isValid);

      if (!bestRelocation) {
        allDisplacedRelocated = false;
        break;
      }

      const normalizedRelocated = normalizeSelectedCandidate(bestRelocation.session);
      newlyRelocated.push(normalizedRelocated);
      activeSessionsForRelocation.push(normalizedRelocated);
    }

    if (allDisplacedRelocated) {
      return {
        placedSession: normalizedPrimary,
        relocatedSessions: newlyRelocated,
      };
    }
  }

  return null;
}

function getUnscheduledConflictTypes(
  scores: PlacementScoreResult[],
) {
  return Array.from(
    new Set(
      scores.flatMap((score) =>
        score.conflicts.map(
          (conflict) =>
            conflict.type,
        ),
      ),
    ),
  ).sort();
}

function getConflictSuggestion(type: string) {
  switch (type) {
    case 'trainer_overlap':
      return 'Move or unlock the named trainer session, choose another free period, or assign another eligible trainer.';
    case 'cohort_overlap':
      return 'Move or unlock the named cohort session, or choose a period when the cohort is free.';
    case 'room_overlap':
      return 'Choose another eligible room, or move or unlock the room booking shown here.';
    case 'trainer_unavailable':
      return 'Add this period to the trainer’s availability, choose one of their available periods, or assign another eligible trainer.';
    case 'hard_constraint':
      return 'Change or disable the named hard constraint, or place the session outside its restricted window.';
    case 'trainer_daily_workload':
    case 'trainer_weekly_workload':
      return 'Reduce the trainer’s assigned load, move another session, or assign another eligible trainer.';
    case 'insufficient_room_capacity':
    case 'incompatible_room_type':
    case 'room_unavailable':
      return 'Make a suitable room available or change the allocation’s room requirement.';
    default:
      return 'Review the affected resource or rule, then regenerate the timetable.';
  }
}

function getUnscheduledBlockers({ scores, input, scheduledSessions }: {
  scores: PlacementScoreResult[];
  input: AutomaticPlannerInput;
  scheduledSessions: PlanningSession[];
}): UnscheduledPlacementBlocker[] {
  const days = new Map(input.workingDays.map((day) => [day.id, day]));
  const slots = new Map(input.timeSlots.map((slot) => [slot.id, slot]));
  const units = new Map(input.units.map((unit) => [unit.id, unit]));
  const cohorts = new Map(input.cohorts.map((cohort) => [cohort.id, cohort]));
  const sessions = new Map(scheduledSessions.map((session) => [session.id, session]));
  const grouped = new Map<string, { type: string; cause: string; windows: Set<string>; candidates: Set<string> }>();

  for (const score of scores) {
    const day = days.get(score.session.workingDayId);
    const start = slots.get(score.session.startTimeSlotId);
    const end = slots.get(score.session.endTimeSlotId);
    const dayName = day?.dayOfWeek
      ? day.dayOfWeek[0].toUpperCase() + day.dayOfWeek.slice(1)
      : 'Unknown day';
    const slotName = start?.code ?? start?.name ?? 'unknown slot';
    const window = `${dayName} ${slotName} (${start?.startsAt.slice(0, 5) ?? '?'}–${end?.endsAt.slice(0, 5) ?? '?'})`;

    for (const conflict of score.conflicts.filter((item) => item.severity === 'blocked')) {
      const other = conflict.sessionIds.map((id) => sessions.get(id)).find(Boolean);
      const otherUnit = other ? units.get(other.unitId) : undefined;
      const otherCohort = other ? cohorts.get(other.cohortId) : undefined;
      const otherDescription = other
        ? ` Conflicts with ${otherUnit?.code ?? otherUnit?.name ?? 'another session'} (${otherCohort?.code ?? 'unknown cohort'}).`
        : '';
      const resource = conflict.resourceLabel ? `${conflict.resourceLabel}: ` : '';
      const cause = `${resource}${conflict.message}${otherDescription}`;
      const key = `${conflict.type}|${cause}`;
      const entry = grouped.get(key) ?? { type: conflict.type, cause, windows: new Set<string>(), candidates: new Set<string>() };
      entry.windows.add(window);
      entry.candidates.add(score.session.id);
      grouped.set(key, entry);
    }
  }

  return Array.from(grouped.values()).map((entry) => ({
    type: entry.type,
    cause: entry.cause,
    suggestion: getConflictSuggestion(entry.type),
    rejectedCandidateCount: entry.candidates.size,
    candidateWindows: Array.from(entry.windows).sort(),
  }));
}

function createUnscheduledMessage({
  conflictTypes,
}: {
  conflictTypes: string[];
}) {
  if (
    conflictTypes.length === 0
  ) {
    return 'No acceptable timetable placement was found.';
  }

  return (
    'No candidate slot passed all required timetable checks.'
  );
}

function calculateStatistics({
  allocations,
  requestedSessionCount,
  sessions,
  unscheduledCount,
  conflicts,
  trainers,
  rooms,
  workingDays,
  timeSlots,
  generationDurationMilliseconds,
}: {
  allocations: PlanningAllocation[];
  requestedSessionCount: number;
  sessions: PlanningSession[];
  unscheduledCount: number;
  conflicts:
    ReturnType<
      typeof detectTimetableConflicts
    >;
  trainers: PlanningTrainer[];
  rooms: PlanningRoom[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  generationDurationMilliseconds: number;
}): PlanningStatistics {
  const activeSessions =
    sessions.filter(isActiveSession);

  const scheduledMinutes =
    activeSessions.reduce(
      (total, session) => {
        const startSlot =
          timeSlots.find(
            (slot) =>
              slot.id ===
              session.startTimeSlotId,
          );

        const endSlot =
          timeSlots.find(
            (slot) =>
              slot.id ===
              session.endTimeSlotId,
          );

        if (
          !startSlot ||
          !endSlot
        ) {
          return total;
        }

        return (
          total +
          getIntervalDurationMinutes({
            startsAt:
              startSlot.startsAt,
            endsAt:
              endSlot.endsAt,
          })
        );
      },
      0,
    );

  const totalTrainerCapacityMinutes =
    trainers.reduce(
      (total, trainer) =>
        total +
        Math.max(
          0,
          trainer.normalWeeklyHours,
        ) *
          60,
      0,
    );

  const enabledTeachingMinutes =
    timeSlots
      .filter(
        (slot) =>
          slot.isEnabled &&
          slot.slotType ===
            'teaching',
      )
      .reduce(
        (total, slot) =>
          total +
          getIntervalDurationMinutes({
            startsAt:
              slot.startsAt,
            endsAt:
              slot.endsAt,
          }),
        0,
      );

  const enabledDayCount =
    workingDays.filter(
      (day) => day.isEnabled,
    ).length;

  const availableRoomMinutes =
    rooms.filter(
      (room) =>
        room.isActive &&
        room.isTimetableAvailable,
    ).length *
    enabledDayCount *
    enabledTeachingMinutes;

  return {
    allocationCount:
      allocations.filter(
        (allocation) =>
          allocation.isTimetableEnabled,
      ).length,
    requestedSessionCount,
    scheduledSessionCount:
      activeSessions.length,
    unscheduledSessionCount:
      unscheduledCount,
    conflictCount:
      conflicts.length,
    blockedConflictCount:
      conflicts.filter(
        (conflict) =>
          conflict.severity ===
          'blocked',
      ).length,
    warningCount:
      conflicts.filter(
        (conflict) =>
          conflict.severity ===
          'warning',
      ).length,
    trainerUtilizationPercentage:
      totalTrainerCapacityMinutes > 0
        ? Number(
            (
              scheduledMinutes /
              totalTrainerCapacityMinutes *
              100
            ).toFixed(1),
          )
        : 0,
    roomUtilizationPercentage:
      availableRoomMinutes > 0
        ? Number(
            (
              scheduledMinutes /
              availableRoomMinutes *
              100
            ).toFixed(1),
          )
        : 0,
    generationDurationMilliseconds,
  };
}

function sessionsTimeOverlap(
  first: PlanningSession,
  second: PlanningSession,
  timeSlotsMap: Map<string, PlanningTimeSlot>,
): boolean {
  if (first.workingDayId !== second.workingDayId) {
    return false;
  }

  const firstStart = timeSlotsMap.get(first.startTimeSlotId);
  const firstEnd = timeSlotsMap.get(first.endTimeSlotId);
  const secondStart = timeSlotsMap.get(second.startTimeSlotId);
  const secondEnd = timeSlotsMap.get(second.endTimeSlotId);

  if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
    return (
      first.startTimeSlotId === second.startTimeSlotId ||
      first.endTimeSlotId === second.endTimeSlotId
    );
  }

  const start1 = parseTimeToMinutes(firstStart.startsAt);
  const end1 = parseTimeToMinutes(firstEnd.endsAt);
  const start2 = parseTimeToMinutes(secondStart.startsAt);
  const end2 = parseTimeToMinutes(secondEnd.endsAt);

  return start1 < end2 && end1 > start2;
}

export function reconcilePreviousVenuesForUnmovedSessions({
  sessions,
  existingSessions = [],
  previousSessions,
  rooms,
  cohorts,
  allocations,
  timeSlots,
}: {
  sessions: PlanningSession[];
  existingSessions?: PlanningSession[];
  previousSessions?: PlanningSession[];
  rooms: PlanningRoom[];
  cohorts: PlanningCohort[];
  allocations: PlanningAllocation[];
  timeSlots: PlanningTimeSlot[];
}): PlanningSession[] {
  if (!previousSessions || previousSessions.length === 0) {
    return sessions;
  }

  const availableRoomsMap = new Map(
    rooms
      .filter((room) => room.isActive && room.isTimetableAvailable)
      .map((room) => [room.id, room]),
  );
  const cohortsMap = new Map(cohorts.map((c) => [c.id, c]));
  const allocationsMap = new Map(allocations.map((a) => [a.id, a]));
  const timeSlotsMap = new Map(timeSlots.map((s) => [s.id, s]));

  const reconciled: PlanningSession[] = [];

  for (const session of sessions) {
    // If the session already has a room assigned, keep it
    if (session.roomId) {
      reconciled.push(session);
      continue;
    }

    // Check if this session corresponds to an unmoved previous session
    const matchingPrev = previousSessions.find((prev) => {
      if (
        prev.workingDayId !== session.workingDayId ||
        prev.startTimeSlotId !== session.startTimeSlotId
      ) {
        return false;
      }
      if (!prev.roomId) {
        return false;
      }
      if (prev.teachingAllocationId === session.teachingAllocationId) {
        return (
          prev.sessionNumber === session.sessionNumber ||
          sessions.filter((s) => s.teachingAllocationId === session.teachingAllocationId).length === 1
        );
      }
      if (prev.cohortId === session.cohortId && prev.unitId === session.unitId) {
        return true;
      }
      return false;
    });

    if (!matchingPrev || !matchingPrev.roomId) {
      reconciled.push(session);
      continue;
    }

    const room = availableRoomsMap.get(matchingPrev.roomId);
    if (!room) {
      reconciled.push(session);
      continue;
    }

    const allocation = allocationsMap.get(session.teachingAllocationId);
    const cohort = cohortsMap.get(session.cohortId);
    const requiredCapacity =
      allocation?.combinedCohortSize ?? cohort?.actualSize ?? 0;
    if (requiredCapacity > 0 && room.capacity < requiredCapacity) {
      reconciled.push(session);
      continue;
    }

    const candidateSession: PlanningSession = {
      ...session,
      roomId: room.id,
    };

    // Verify room has no conflict with any already scheduled session (including locked/existing sessions)
    const allOtherSessions = [
      ...existingSessions,
      ...reconciled,
      ...sessions.filter((s) => s.id !== session.id),
    ];

    const hasCollision = allOtherSessions.some(
      (other) =>
        other.id !== session.id &&
        other.roomId === room.id &&
        isActiveSession(other) &&
        sessionsTimeOverlap(candidateSession, other, timeSlotsMap),
    );

    if (hasCollision) {
      reconciled.push(session);
      continue;
    }

    reconciled.push(candidateSession);
  }

  return reconciled;
}

export function generateTimetablePlan(
  input: AutomaticPlannerInput,
): AutomaticPlannerResult {
  const startedAt =
    Date.now();

  const existingSessions =
    (
      input.existingSessions ??
      []
    ).filter(isActiveSession);

  const workingDays =
    input.workingDays
      .filter(
        (day) =>
          day.isEnabled &&
          day.academicPeriodId ===
            input.academicPeriodId,
      )
      .sort(
        (first, second) =>
          first.sequenceNumber -
            second.sequenceNumber ||
          first.id.localeCompare(
            second.id,
          ),
      );

  const timeSlots =
    input.timeSlots.filter(
      (slot) =>
        slot.isEnabled &&
        slot.slotType ===
          'teaching' &&
        slot.academicPeriodId ===
          input.academicPeriodId,
    );

  const requests =
    createSessionRequests({
      allocations:
        input.allocations.filter(
          (allocation) =>
            allocation
              .academicPeriodId ===
            input.academicPeriodId,
        ),
      cohorts: input.cohorts,
      units: input.units,
      rooms: input.rooms,
      trainers: input.trainers,
      activeDepartmentId: input.activeDepartmentId,
    }).filter((request) =>
      !existingSessions.some((session) =>
        sessionSatisfiesRequest({
          session,
          allocation: request.allocation,
          sessionNumber: request.sessionNumber,
        }),
      ),
    );

  const selectedSessions:
  PlanningSession[] = [];

  const unscheduled:
  UnscheduledPlanningSession[] = [];

  const suggestions:
  PlanningSuggestion[] = [];

  const cohortLookup =
    buildLookup(input.cohorts);

  const trainerLookup =
    buildLookup(input.trainers);

  const unitLookup =
    buildLookup(input.units);

  const allocationLookup =
    buildLookup(input.allocations);

  const candidateLimit =
    input.options
      ?.candidateLimitPerRequest ??
    250;

  const allowSameDay =
    input.options
      ?.allowSameAllocationMultipleSessionsPerDay ??
    false;

  for (const request of requests) {
    const {
      allocation,
      sessionNumber,
    } = request;

    const fixedTimeSlotIds =
      allocation.fixedTimeSlotIds ?? [];
    const fixedWorkingDayIds =
      allocation.fixedWorkingDayIds ?? [];
    const configuredFixedDays = fixedTimeSlotIds.map(
      (_, index) =>
        fixedWorkingDayIds[index] ??
        allocation.fixedWorkingDayId ??
        null,
    );
    const linkedFixedSessionCount =
      fixedTimeSlotIds.length > 1 &&
      new Set(configuredFixedDays).size === 1 &&
      configuredFixedDays[0]
        ? fixedTimeSlotIds.length
        : 0;

    if (
      linkedFixedSessionCount > 1 &&
      sessionNumber <= linkedFixedSessionCount &&
      unscheduled.some(
        (item) =>
          item.teachingAllocationId === allocation.id &&
          item.sessionNumber < sessionNumber,
      )
    ) {
      unscheduled.push({
        teachingAllocationId: allocation.id,
        sessionNumber,
        reason: 'no_valid_placement',
        message:
          'The linked fixed session was not scheduled because the complete double session could not be placed.',
        attemptedCandidateCount: 0,
        conflictTypes: ['linked_fixed_session'],
        blockers: [],
      });

      continue;
    }

    const cohort =
      cohortLookup.get(
        allocation.cohortId,
      );

    const trainer = allocation.trainerId
      ? trainerLookup.get(
          allocation.trainerId,
        )
      : undefined;

    const unit =
      unitLookup.get(
        allocation.unitId,
      );

    if (
      !cohort ||
      !unit ||
      (Boolean(allocation.trainerId) && !trainer)
    ) {
      unscheduled.push({
        teachingAllocationId:
          allocation.id,
        sessionNumber,
        reason:
          'missing_relationship',
        message:
          'The allocation references a missing cohort, trainer, or unit.',
        attemptedCandidateCount: 0,
        conflictTypes: [],
        blockers: [],
      });

      continue;
    }

    if (workingDays.length === 0) {
      unscheduled.push({
        teachingAllocationId:
          allocation.id,
        sessionNumber,
        reason: 'no_working_days',
        message:
          'No enabled working days exist for the Academic Period.',
        attemptedCandidateCount: 0,
        conflictTypes: [],
        blockers: [],
      });

      continue;
    }

    const timeRanges = allocation.isFullDaySession
      ? buildFullDayTimeRange({
          timeSlots,
          startTimeSlotId:
            allocation.fixedTimeSlotIds?.[0],
          endTimeSlotId:
            allocation.fixedEndTimeSlotId,
          durationMinutes:
            allocation.sessionDurationMinutes,
        })
      : buildContiguousTimeRanges({
          timeSlots,
          durationMinutes:
            allocation.sessionDurationMinutes,
        });

    if (timeRanges.length === 0) {
      unscheduled.push({
        teachingAllocationId:
          allocation.id,
        sessionNumber,
        reason: 'no_time_range',
        message: allocation.isFullDaySession
          ? 'The full-day session is incomplete. Save its fixed day and 08:00–16:00 range again.'
          : `No contiguous teaching-slot range matches ${allocation.sessionDurationMinutes} minutes.`,
        attemptedCandidateCount: 0,
        conflictTypes: [],
        blockers: [],
      });

      continue;
    }

    const eligibleRooms =
      getEligibleRooms({
        allocation,
        rooms: input.rooms,
        cohort,
        unit,
      });

    if (eligibleRooms.length === 0) {
      unscheduled.push({
        teachingAllocationId:
          allocation.id,
        sessionNumber,
        reason: 'no_rooms',
        message:
          'No active timetable-available room is eligible for this allocation.',
        attemptedCandidateCount: 0,
        conflictTypes: [],
        blockers: [],
      });

      continue;
    }

    const candidates =
      createCandidateSessions({
        request,
        workingDays,
        timeRanges,
        rooms: eligibleRooms,
        selectedSessions: [
          ...existingSessions,
          ...selectedSessions,
        ],
        allowSameAllocationMultipleSessionsPerDay:
          allowSameDay,
        previousSessions: input.previousSessions,
        cohort,
        allRooms: input.rooms,
      }).slice(
        0,
        candidateLimit,
      );

    // TEMPORARY DIAGNOSTIC — remove after the zero-candidate investigation
    // for allocation.id === '9a536347-96d6-415f-aee3-f9f7bc81e2b2' is done.
    if (candidates.length === 0) {
      console.error('[zero-candidates]', {
        allocationId: allocation.id,
        sessionNumber,
        fixedWorkingDayId: allocation.fixedWorkingDayId,
        fixedWorkingDayIds: allocation.fixedWorkingDayIds,
        fixedTimeSlotIds: allocation.fixedTimeSlotIds,
        isFullDaySession: allocation.isFullDaySession,
        sessionDurationMinutes: allocation.sessionDurationMinutes,
        preferredRoomId: allocation.preferredRoomId,
        eligibleRoomsPassedIn: eligibleRooms.map((r) => r?.id ?? null),
        workingDayIdsInScope: workingDays.map((d) => d.id),
        timeRangesInScope: timeRanges.map((r) => ({
          start: r.startTimeSlotId,
          end: r.endTimeSlotId,
          minutes: r.durationMinutes,
        })),
      });
    }

    const scores =
      scorePlacements({
        candidates,
        existingSessions: [
          ...existingSessions,
          ...selectedSessions,
        ],
        workingDays:
          input.workingDays,
        timeSlots:
          input.timeSlots,
        trainers:
          input.trainers,
        cohorts:
          input.cohorts,
        rooms:
          input.rooms,
        units:
          input.units,
        constraints:
          input.constraints,
      });

    let bestPlacement =
      scores.find(
        (score) =>
          score.isValid,
      );

    if (!bestPlacement) {
      // Try relocating 1 or 2 flexible conflicting sessions to free up this slot
      const repairResult = tryRelocationRepair({
        request,
        candidateScores: scores,
        selectedSessions,
        existingSessions,
        workingDays,
        timeSlots,
        rooms: input.rooms,
        trainers: input.trainers,
        cohorts: input.cohorts,
        units: input.units,
        constraints: input.constraints,
        candidateLimit,
        allowSameDay,
        allocationLookup,
        previousSessions: input.previousSessions,
      });

      if (repairResult) {
        const relocatedKeys = new Set(
          repairResult.relocatedSessions.map(
            (s) => `${s.teachingAllocationId}:${s.sessionNumber}`,
          ),
        );

        const remainingSelected = selectedSessions.filter(
          (s) => !relocatedKeys.has(`${s.teachingAllocationId}:${s.sessionNumber}`),
        );

        selectedSessions.length = 0;
        selectedSessions.push(
          ...remainingSelected,
          repairResult.placedSession,
          ...repairResult.relocatedSessions,
        );

        continue;
      }

      const conflictTypes =
        getUnscheduledConflictTypes(
          scores,
        );

      if (
        linkedFixedSessionCount > 1 &&
        sessionNumber <= linkedFixedSessionCount
      ) {
        const linkedSelectedSessions = selectedSessions.filter(
          (session) =>
            session.teachingAllocationId === allocation.id &&
            session.sessionNumber <= linkedFixedSessionCount,
        );

        for (const linkedSession of linkedSelectedSessions) {
          const selectedIndex = selectedSessions.findIndex(
            (session) => session.id === linkedSession.id,
          );

          if (selectedIndex >= 0) {
            selectedSessions.splice(selectedIndex, 1);
          }

          unscheduled.push({
            teachingAllocationId: allocation.id,
            sessionNumber: linkedSession.sessionNumber,
            reason: 'no_valid_placement',
            message:
              'The linked fixed session was removed because the complete double session could not be placed.',
            attemptedCandidateCount: scores.length,
            conflictTypes,
            blockers: getUnscheduledBlockers({
              scores,
              input,
              scheduledSessions: [...existingSessions, ...selectedSessions],
            }),
          });
        }
      }

      const conflictId = `${allocation.id}:${sessionNumber}`;

      // Relaxed recovery search: unlike the strict candidate pass above
      // (which only ever tries the allocation's single preferred room, or
      // none — see getEligibleRooms), this searches every active,
      // timetable-available room in the department, on every enabled
      // working day, ignoring any fixed day/time pin that may have caused
      // the failure. Trainer stays fixed to the allocation's assigned
      // trainer — reassigning trainers is a separate, curated feature
      // (see findTrainerExchangeSuggestions in exchange-repair.ts).
      const recoverySession: PlanningSession = {
        id: `unscheduled-request:${conflictId}`,
        academicPeriodId: allocation.academicPeriodId,
        teachingAllocationId: allocation.id,
        cohortId: allocation.cohortId,
        unitId: allocation.unitId,
        trainerId: allocation.trainerId,
        workingDayId: '',
        startTimeSlotId: '',
        endTimeSlotId: '',
        // Truthy sentinel (never a real room id): tells createPlacementCandidates
        // to search `rooms` rather than treat this as a roomless session.
        roomId: 'requires-room-search',
        sessionNumber,
        deliveryMode: allocation.deliveryMode,
        status: 'draft',
        source: 'generator',
        conflictState: 'unchecked',
        isLocked: false,
        participantCohortIds: allocation.participantCohortIds,
        combinedCohortSize: allocation.combinedCohortSize,
      };

      const recoveryCandidates = createPlacementCandidates({
        session: recoverySession,
        workingDays,
        timeRanges,
        rooms: input.rooms,
      }).slice(0, Math.min(candidateLimit, 150));

      const recoverySuggestions = suggestAlternativePlacements({
        conflictId,
        session: recoverySession,
        candidates: recoveryCandidates,
        existingSessions: [...existingSessions, ...selectedSessions],
        workingDays: input.workingDays,
        timeSlots: input.timeSlots,
        trainers: input.trainers,
        cohorts: input.cohorts,
        rooms: input.rooms,
        units: input.units,
        constraints: input.constraints,
        limit: 3,
      });

      suggestions.push(...recoverySuggestions);

      unscheduled.push({
        teachingAllocationId:
          allocation.id,
        sessionNumber,
        reason:
          'no_valid_placement',
        message:
          createUnscheduledMessage({
            conflictTypes,
          }),
        attemptedCandidateCount:
          scores.length,
        conflictTypes,
        blockers: getUnscheduledBlockers({
          scores,
          input,
          scheduledSessions: [...existingSessions, ...selectedSessions],
        }),
      });

      continue;
    }

    selectedSessions.push(
      normalizeSelectedCandidate(
        bestPlacement.session,
      ),
    );
  }

  const reconciledSessions = reconcilePreviousVenuesForUnmovedSessions({
    sessions: selectedSessions,
    existingSessions,
    previousSessions: input.previousSessions,
    rooms: input.rooms,
    cohorts: input.cohorts,
    allocations: input.allocations,
    timeSlots: input.timeSlots,
  });

  const sessions = [
    ...existingSessions,
    ...reconciledSessions,
  ];

  const conflicts =
    detectTimetableConflicts({
      sessions,
      workingDays:
        input.workingDays,
      timeSlots:
        input.timeSlots,
      trainers:
        input.trainers,
      cohorts:
        input.cohorts,
      rooms:
        input.rooms,
      units:
        input.units,
      constraints:
        input.constraints,
    });

  const statistics =
    calculateStatistics({
      allocations:
        input.allocations,
      requestedSessionCount:
        requests.length,
      sessions:
        reconciledSessions,
      unscheduledCount:
        unscheduled.length,
      conflicts,
      trainers:
        input.trainers,
      rooms:
        input.rooms,
      workingDays:
        input.workingDays,
      timeSlots:
        input.timeSlots,
      generationDurationMilliseconds:
        Date.now() - startedAt,
    });

  return {
    sessions: reconciledSessions,
    unscheduled,
    conflicts,
    suggestions,
    statistics,
  };
}