import {
  detectTimetableConflicts,
} from './conflict-detector';
import {
  scorePlacements,
  type PlacementScoreResult,
} from './scorer';
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
}

export interface AutomaticPlannerInput {
  academicPeriodId: string;
  activeDepartmentId?: string | null;
  allocations: PlanningAllocation[];
  existingSessions?: PlanningSession[];
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

  if (!fixedTimeSlotId) {
    return true;
  }

  const fixedWorkingDayId =
    allocation.fixedWorkingDayIds?.[sessionNumber - 1] ??
    allocation.fixedWorkingDayId ??
    null;

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
  if (!startTimeSlotId || !endTimeSlotId) {
    return [];
  }

  const startSlot = timeSlots.find(
    (slot) => slot.id === startTimeSlotId,
  );
  const endSlot = timeSlots.find(
    (slot) => slot.id === endTimeSlotId,
  );

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

  if (rangeDuration !== durationMinutes) {
    return [];
  }

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
  eligibleRoomCount,
}: {
  allocation: PlanningAllocation;
  cohort?: PlanningCohort;
  unit?: PlanningUnit;
  eligibleRoomCount: number;
}) {
  let score = 0;

  score +=
    allocation.sessionDurationMinutes;

  score +=
    allocation.weeklySessions * 20;

  score +=
    cohort?.actualSize ?? 0;

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
}: {
  allocation: PlanningAllocation;
  sessionNumber: number;
}) {
  const fixedTimeSlotId =
    allocation.fixedTimeSlotIds?.[
      sessionNumber - 1
    ];

  const fixedWorkingDayId =
    allocation.fixedWorkingDayIds?.[
      sessionNumber - 1
    ] ?? allocation.fixedWorkingDayId;

  if (
    allocation.isFullDaySession &&
    fixedTimeSlotId &&
    fixedWorkingDayId
  ) {
    return 2;
  }

  if (
    fixedTimeSlotId &&
    fixedWorkingDayId
  ) {
    return 1;
  }

  return 0;
}

function createSessionRequests({
  allocations,
  cohorts,
  units,
  rooms,
}: Pick<
  AutomaticPlannerInput,
  | 'allocations'
  | 'cohorts'
  | 'units'
  | 'rooms'
>): SessionRequest[] {
  const cohortLookup =
    buildLookup(cohorts);

  const unitLookup =
    buildLookup(units);

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
}: {
  allocation: PlanningAllocation;
  rooms: PlanningRoom[];
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

  return availableRooms.filter(
    (room) =>
      room.id ===
      allocation.preferredRoomId,
  );
}

function createCandidateSessions({
  request,
  workingDays,
  timeRanges,
  rooms,
  selectedSessions,
  allowSameAllocationMultipleSessionsPerDay,
}: {
  request: SessionRequest;
  workingDays: PlanningWorkingDay[];
  timeRanges: TimeSlotRange[];
  rooms: Array<PlanningRoom | null>;
  selectedSessions: PlanningSession[];
  allowSameAllocationMultipleSessionsPerDay: boolean;
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

  const fixedWorkingDayId = fixedTimeSlotId
    ? fixedWorkingDayIds[sessionNumber - 1] ??
      allocation.fixedWorkingDayId ??
      null
    : null;

  const configuredFixedDays = fixedTimeSlotIds.map(
    (_, index) =>
      fixedWorkingDayIds[index] ??
      allocation.fixedWorkingDayId ??
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

      for (const room of candidateRooms) {
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
    'Every candidate placement was rejected because of: ' +
    conflictTypes
      .join(', ')
      .replaceAll('_', ' ') +
    '.'
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

  const cohortLookup =
    buildLookup(input.cohorts);

  const trainerLookup =
    buildLookup(input.trainers);

  const unitLookup =
    buildLookup(input.units);

  const candidateLimit =
    input.options
      ?.candidateLimitPerRequest ??
    5000;

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
      });

      continue;
    }

    const eligibleRooms =
      getEligibleRooms({
        allocation,
        rooms: input.rooms,
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
      }).slice(
        0,
        candidateLimit,
      );

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

    const bestPlacement =
      scores.find(
        (score) =>
          score.isValid,
      );

    if (!bestPlacement) {
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
          });
        }
      }

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
      });

      continue;
    }

    selectedSessions.push(
      normalizeSelectedCandidate(
        bestPlacement.session,
      ),
    );
  }

  const sessions = [
    ...existingSessions,
    ...selectedSessions,
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

  const suggestions:
  PlanningSuggestion[] = [];

  const statistics =
    calculateStatistics({
      allocations:
        input.allocations,
      requestedSessionCount:
        requests.length,
      sessions:
        selectedSessions,
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
    sessions: selectedSessions,
    unscheduled,
    conflicts,
    suggestions,
    statistics,
  };
}
