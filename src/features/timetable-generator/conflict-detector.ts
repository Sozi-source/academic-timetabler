import {
  resolveSessionInterval,
} from './session-time';
import {
  timeIntervalsOverlap,
} from './overlap';
import {
  detectTrainerWorkloadConflicts,
} from './workload';
import {
  parseTimeToMinutes,
} from './time';
import {
  findOverlappingParticipantCohortId,
  normalizeParticipantCohortIds,
} from './participant-cohorts';
import type {
  PlanningCohort,
  PlanningConflict,
  PlanningConflictSeverity,
  PlanningConflictType,
  PlanningConstraint,
  PlanningRoom,
  PlanningSession,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningUnit,
  PlanningWorkingDay,
  TimeInterval,
} from './types';

export interface DetectTimetableConflictsInput {
  sessions: PlanningSession[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  trainers: PlanningTrainer[];
  cohorts: PlanningCohort[];
  rooms: PlanningRoom[];
  units: PlanningUnit[];
  constraints?: PlanningConstraint[];
}

interface SessionContext {
  session: PlanningSession;
  workingDay?: PlanningWorkingDay;
  startTimeSlot?: PlanningTimeSlot;
  endTimeSlot?: PlanningTimeSlot;
  trainer?: PlanningTrainer;
  cohort?: PlanningCohort;
  room?: PlanningRoom;
  unit?: PlanningUnit;
  participantCohortIds: string[];
  unavailableParticipantCohortIds: string[];
  interval?: TimeInterval;
  requiredTimeSlotIds: string[];
}

function isActiveSession(
  session: PlanningSession,
): boolean {
  return ![
    'cancelled',
    'archived',
  ].includes(session.status);
}

function createConflictId({
  type,
  sessionIds,
  resourceId,
}: {
  type: PlanningConflictType;
  sessionIds: string[];
  resourceId?: string;
}) {
  return [
    type,
    [...sessionIds].sort().join(':'),
    resourceId ?? 'none',
  ].join('|');
}

function createConflict({
  type,
  severity,
  message,
  sessionIds,
  resourceId,
  resourceLabel,
  workingDayId,
  metadata,
}: {
  type: PlanningConflictType;
  severity: PlanningConflictSeverity;
  message: string;
  sessionIds: string[];
  resourceId?: string;
  resourceLabel?: string;
  workingDayId?: string;
  metadata?: Record<
    string,
    string | number | boolean | null
  >;
}): PlanningConflict {
  return {
    id: createConflictId({
      type,
      sessionIds,
      resourceId,
    }),
    type,
    severity,
    message,
    sessionIds: [...sessionIds].sort(),
    resourceId,
    resourceLabel,
    workingDayId,
    metadata,
  };
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

function resolveContexts(
  input: DetectTimetableConflictsInput,
): SessionContext[] {
  const workingDays =
    buildLookup(input.workingDays);

  const timeSlots =
    buildLookup(input.timeSlots);

  const trainers =
    buildLookup(input.trainers);

  const cohorts =
    buildLookup(input.cohorts);

  const rooms =
    buildLookup(input.rooms);

  const units =
    buildLookup(input.units);

  return input.sessions
    .filter(isActiveSession)
    .map((session) => {
      const participantCohortIds =
        normalizeParticipantCohortIds({
          cohortId: session.cohortId,
          participantCohortIds:
            session.participantCohortIds,
        });

      const context: SessionContext = {
        session,
        workingDay:
          workingDays.get(
            session.workingDayId,
          ),
        startTimeSlot:
          timeSlots.get(
            session.startTimeSlotId,
          ),
        endTimeSlot:
          timeSlots.get(
            session.endTimeSlotId,
          ),
        trainer: session.trainerId
          ? trainers.get(
              session.trainerId,
            )
          : undefined,
        cohort:
          cohorts.get(
            session.cohortId,
          ),
        room: session.roomId
          ? rooms.get(session.roomId)
          : undefined,
        unit:
          units.get(
            session.unitId,
          ),
        participantCohortIds,
        unavailableParticipantCohortIds:
          participantCohortIds.filter((cohortId) => {
            const participant = cohorts.get(cohortId);
            return !participant || !participant.isTimetableAvailable;
          }),
        requiredTimeSlotIds: [],
      };

      if (
        context.startTimeSlot &&
        context.endTimeSlot
      ) {
        context.requiredTimeSlotIds = input.timeSlots
          .filter((slot) => (
            slot.academicPeriodId === session.academicPeriodId
            && slot.isEnabled
            && slot.slotType === 'teaching'
            && slot.sequenceNumber >= context.startTimeSlot!.sequenceNumber
            && slot.sequenceNumber <= context.endTimeSlot!.sequenceNumber
          ))
          .map((slot) => slot.id);

        try {
          context.interval =
            resolveSessionInterval({
              session,
              timeSlots,
            });
        }
        catch {
          context.interval = undefined;
        }
      }

      return context;
    });
}

function detectCalendarConflicts(
  context: SessionContext,
): PlanningConflict[] {
  const conflicts: PlanningConflict[] = [];

  const {
    session,
    workingDay,
    startTimeSlot,
    endTimeSlot,
    interval,
  } = context;

  if (!workingDay) {
    conflicts.push(
      createConflict({
        type: 'disabled_working_day',
        severity: 'blocked',
        message:
          'The selected working day does not exist.',
        sessionIds: [session.id],
        workingDayId:
          session.workingDayId,
      }),
    );
  }
  else {
    if (!workingDay.isEnabled) {
      conflicts.push(
        createConflict({
          type: 'disabled_working_day',
          severity: 'blocked',
          message:
            'The selected working day is disabled.',
          sessionIds: [session.id],
          workingDayId:
            workingDay.id,
          resourceId: workingDay.id,
          resourceLabel:
            workingDay.dayOfWeek,
        }),
      );
    }

    if (
      workingDay.academicPeriodId !==
      session.academicPeriodId
    ) {
      conflicts.push(
        createConflict({
          type: 'academic_period_mismatch',
          severity: 'blocked',
          message:
            'The working day belongs to a different Academic Period.',
          sessionIds: [session.id],
          workingDayId:
            workingDay.id,
          resourceId: workingDay.id,
        }),
      );
    }
  }

  for (const timeSlot of [
    startTimeSlot,
    endTimeSlot,
  ]) {
    if (!timeSlot) {
      conflicts.push(
        createConflict({
          type: 'disabled_time_slot',
          severity: 'blocked',
          message:
            'A referenced time slot does not exist.',
          sessionIds: [session.id],
          workingDayId:
            session.workingDayId,
        }),
      );

      continue;
    }

    if (!timeSlot.isEnabled) {
      conflicts.push(
        createConflict({
          type: 'disabled_time_slot',
          severity: 'blocked',
          message:
            `Time slot ${timeSlot.code} is disabled.`,
          sessionIds: [session.id],
          workingDayId:
            session.workingDayId,
          resourceId: timeSlot.id,
          resourceLabel:
            timeSlot.name,
        }),
      );
    }

    if (
      timeSlot.slotType !== 'teaching'
    ) {
      conflicts.push(
        createConflict({
          type: 'non_teaching_time_slot',
          severity: 'blocked',
          message:
            `Time slot ${timeSlot.code} is not a teaching slot.`,
          sessionIds: [session.id],
          workingDayId:
            session.workingDayId,
          resourceId: timeSlot.id,
          resourceLabel:
            timeSlot.name,
          metadata: {
            slotType:
              timeSlot.slotType,
          },
        }),
      );
    }

    if (
      timeSlot.academicPeriodId !==
      session.academicPeriodId
    ) {
      conflicts.push(
        createConflict({
          type: 'academic_period_mismatch',
          severity: 'blocked',
          message:
            `Time slot ${timeSlot.code} belongs to a different Academic Period.`,
          sessionIds: [session.id],
          workingDayId:
            session.workingDayId,
          resourceId: timeSlot.id,
        }),
      );
    }
  }

  if (!interval) {
    conflicts.push(
      createConflict({
        type: 'invalid_time_range',
        severity: 'blocked',
        message:
          'The session has an invalid or unresolved time range.',
        sessionIds: [session.id],
        workingDayId:
          session.workingDayId,
      }),
    );
  }

  return conflicts;
}

function detectResourceAvailabilityConflicts(
  context: SessionContext,
): PlanningConflict[] {
  if (context.session.isExternal) {
    return [];
  }

  const conflicts: PlanningConflict[] = [];

  const {
    session,
    trainer,
    cohort,
    room,
    unit,
    requiredTimeSlotIds,
    unavailableParticipantCohortIds,
  } = context;

  if (!session.trainerId) {
    conflicts.push(
      createConflict({
        type: 'trainer_pending',
        severity: 'warning',
        message:
          'This timetable session has no assigned trainer and will be marked UNASSIGNED in the master timetable.',
        sessionIds: [session.id],
        workingDayId:
          session.workingDayId,
      }),
    );
  }
  else if (
    !trainer ||
    !trainer.isActive ||
    !trainer.isTimetableAvailable
  ) {
    conflicts.push(
      createConflict({
        type: 'trainer_unavailable',
        severity: 'blocked',
        message:
          'The trainer is not available for timetabling.',
        sessionIds: [session.id],
        resourceId:
          session.trainerId,
        resourceLabel:
          trainer?.fullName,
        workingDayId:
          session.workingDayId,
      }),
    );
  }
  else if (trainer.availabilityMode === 'selected_slots_only') {
    const availableSlots = new Set(
      (trainer.availableSlots ?? []).map(
        (slot) => `${slot.workingDayId}:${slot.timeSlotId}`,
      ),
    );
    const missingAvailability = requiredTimeSlotIds.some(
      (timeSlotId) => !availableSlots.has(
        `${session.workingDayId}:${timeSlotId}`,
      ),
    );

    if (missingAvailability) {
      conflicts.push(
        createConflict({
          type: 'trainer_unavailable',
          severity: 'blocked',
          message:
            'The trainer is unavailable during one or more required teaching periods.',
          sessionIds: [session.id],
          resourceId: trainer.id,
          resourceLabel: trainer.fullName,
          workingDayId: session.workingDayId,
          metadata: {
            availabilityMode: trainer.availabilityMode,
          },
        }),
      );
    }
  }

  for (const cohortId of unavailableParticipantCohortIds) {
    conflicts.push(
      createConflict({
        type: 'cohort_unavailable',
        severity: 'blocked',
        message:
          'A participating cohort is not available for timetabling.',
        sessionIds: [session.id],
        resourceId: cohortId,
        resourceLabel:
          cohortId === session.cohortId
            ? cohort?.name
            : undefined,
        workingDayId:
          session.workingDayId,
        metadata: {
          participantCohortId: cohortId,
        },
      }),
    );
  }

  if (
    session.roomId &&
    (!room || !room.isActive || !room.isTimetableAvailable)
  ) {
    conflicts.push(
      createConflict({
        type: 'room_unavailable',
        severity: 'blocked',
        message:
          'The room is not available for timetabling.',
        sessionIds: [session.id],
        resourceId:
          session.roomId,
        resourceLabel:
          room?.name,
        workingDayId:
          session.workingDayId,
      }),
    );
  }

  if (
    !unit ||
    !unit.isActive ||
    !unit.isTimetableAvailable
  ) {
    conflicts.push(
      createConflict({
        type: 'unit_unavailable',
        severity: 'blocked',
        message:
          'The unit is not available for timetabling.',
        sessionIds: [session.id],
        resourceId:
          session.unitId,
        resourceLabel:
          unit?.name,
        workingDayId:
          session.workingDayId,
      }),
    );
  }

  return conflicts;
}

function detectRoomSuitabilityConflicts(
  context: SessionContext,
): PlanningConflict[] {
  const {
    session,
    cohort,
    room,
    unit,
  } = context;

  if (session.isExternal) {
    return [];
  }

  if (!room) {
    return [];
  }

  const conflicts: PlanningConflict[] = [];

  if (
    cohort &&
    (session.combinedCohortSize ?? cohort.actualSize) > 0 &&
    room.capacity < (session.combinedCohortSize ?? cohort.actualSize)
  ) {
    conflicts.push(
      createConflict({
        type:
          'insufficient_room_capacity',
        severity: 'blocked',
        message:
          `Room ${room.code} has capacity ${room.capacity}, below the combined class size of ${session.combinedCohortSize ?? cohort.actualSize}.`,
        sessionIds: [session.id],
        resourceId: room.id,
        resourceLabel: room.name,
        workingDayId:
          session.workingDayId,
        metadata: {
          roomCapacity:
            room.capacity,
          cohortSize:
            session.combinedCohortSize ?? cohort.actualSize,
        },
      }),
    );
  }

  if (
    unit?.preferredRoomType &&
    room.roomType !==
      unit.preferredRoomType
  ) {
    conflicts.push(
      createConflict({
        type:
          'incompatible_room_type',
        severity: 'blocked',
        message:
          `Unit ${unit.code} requires a ${unit.preferredRoomType} room, but ${room.code} is ${room.roomType}.`,
        sessionIds: [session.id],
        resourceId: room.id,
        resourceLabel: room.name,
        workingDayId:
          session.workingDayId,
        metadata: {
          requiredRoomType:
            unit.preferredRoomType,
          selectedRoomType:
            room.roomType,
        },
      }),
    );
  }

  return conflicts;
}

function constraintSubjectMatches(
  context: SessionContext,
  constraint: PlanningConstraint,
) {
  switch (constraint.subjectType) {
    case 'institution':
      return true;
    case 'trainer':
      return Boolean(
        constraint.subjectId &&
        constraint.subjectId === context.session.trainerId,
      );
    case 'room':
      return Boolean(
        constraint.subjectId &&
        constraint.subjectId === context.session.roomId,
      );
    case 'cohort':
      return Boolean(
        constraint.subjectId &&
        context.participantCohortIds.includes(constraint.subjectId),
      );
  }
}

function constraintDayMatches(
  context: SessionContext,
  constraint: PlanningConstraint,
) {
  return !constraint.workingDayId ||
    constraint.workingDayId === context.session.workingDayId;
}

function constraintWindowOverlaps(
  context: SessionContext,
  constraint: PlanningConstraint,
) {
  if (!constraintDayMatches(context, constraint)) {
    return false;
  }

  if (!constraint.startsAt || !constraint.endsAt) {
    return true;
  }

  if (!context.interval) {
    return false;
  }

  return parseTimeToMinutes(context.interval.startsAt) <
      parseTimeToMinutes(constraint.endsAt) &&
    parseTimeToMinutes(constraint.startsAt) <
      parseTimeToMinutes(context.interval.endsAt);
}

function constraintWindowContains(
  context: SessionContext,
  constraint: PlanningConstraint,
) {
  if (!constraintDayMatches(context, constraint)) {
    return false;
  }

  if (!constraint.startsAt || !constraint.endsAt) {
    return true;
  }

  if (!context.interval) {
    return false;
  }

  return parseTimeToMinutes(context.interval.startsAt) >=
      parseTimeToMinutes(constraint.startsAt) &&
    parseTimeToMinutes(context.interval.endsAt) <=
      parseTimeToMinutes(constraint.endsAt);
}

function getConstraintResourceLabel(
  context: SessionContext,
  constraint: PlanningConstraint,
) {
  switch (constraint.subjectType) {
    case 'institution':
      return 'Institution';
    case 'trainer':
      return context.trainer?.fullName;
    case 'room':
      return context.room?.name;
    case 'cohort':
      return constraint.subjectId === context.session.cohortId
        ? context.cohort?.name
        : 'Participating cohort';
  }
}

function createSchedulingConstraintConflict({
  context,
  constraints,
}: {
  context: SessionContext;
  constraints: PlanningConstraint[];
}) {
  const first = constraints[0];
  const severity = first.priority === 'hard'
    ? 'blocked' as const
    : 'warning' as const;
  const type = first.priority === 'hard'
    ? 'hard_constraint' as const
    : 'soft_constraint' as const;
  const reasons = Array.from(new Set(
    constraints.map((constraint) => constraint.reason.trim()),
  )).filter(Boolean);
  const isPositive = [
    'preferred',
    'required',
  ].includes(first.constraintType);

  return createConflict({
    type,
    severity,
    message: isPositive
      ? `The placement is outside the configured ${first.constraintType} window: ${reasons.join('; ')}.`
      : `The placement violates a configured ${first.constraintType} rule: ${reasons.join('; ')}.`,
    sessionIds: [context.session.id],
    resourceId: first.id,
    resourceLabel:
      getConstraintResourceLabel(context, first),
    workingDayId:
      context.session.workingDayId,
    metadata: {
      constraintId: constraints.map((constraint) => constraint.id).join(','),
      constraintType: first.constraintType,
      constraintSubjectType: first.subjectType,
      constraintSubjectId: first.subjectId,
    },
  });
}

function detectSchedulingConstraintConflicts(
  context: SessionContext,
  constraints: PlanningConstraint[],
) {
  if (context.session.isExternal) {
    return [];
  }

  const relevant = constraints.filter((constraint) =>
    constraint.isActive &&
    constraint.academicPeriodId === context.session.academicPeriodId &&
    constraintSubjectMatches(context, constraint),
  );
  const conflicts: PlanningConflict[] = [];

  for (const constraint of relevant.filter((item) =>
    ['unavailable', 'protected_day'].includes(item.constraintType),
  )) {
    if (constraintWindowOverlaps(context, constraint)) {
      conflicts.push(createSchedulingConstraintConflict({
        context,
        constraints: [constraint],
      }));
    }
  }

  const positiveGroups = new Map<string, PlanningConstraint[]>();
  for (const constraint of relevant.filter((item) =>
    ['preferred', 'required'].includes(item.constraintType),
  )) {
    const key = [
      constraint.subjectType,
      constraint.subjectId ?? 'institution',
      constraint.constraintType,
      constraint.priority,
    ].join('|');
    const group = positiveGroups.get(key) ?? [];
    group.push(constraint);
    positiveGroups.set(key, group);
  }

  for (const group of positiveGroups.values()) {
    if (!group.some((constraint) =>
      constraintWindowContains(context, constraint),
    )) {
      conflicts.push(createSchedulingConstraintConflict({
        context,
        constraints: group,
      }));
    }
  }

  return conflicts;
}

function detectDuplicateConflicts(
  contexts: SessionContext[],
): PlanningConflict[] {
  const conflicts: PlanningConflict[] = [];

  for (
    let firstIndex = 0;
    firstIndex < contexts.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex < contexts.length;
      secondIndex += 1
    ) {
      const first =
        contexts[firstIndex];

      const second =
        contexts[secondIndex];

      const sameNumberedSession =
        first.session
          .teachingAllocationId ===
          second.session
            .teachingAllocationId &&
        first.session.sessionNumber ===
          second.session.sessionNumber;

      const samePlacement =
        first.session
          .academicPeriodId ===
          second.session
            .academicPeriodId &&
        first.session
          .teachingAllocationId ===
          second.session
            .teachingAllocationId &&
        first.session.workingDayId ===
          second.session.workingDayId &&
        first.session
          .startTimeSlotId ===
          second.session
            .startTimeSlotId &&
        first.session.endTimeSlotId ===
          second.session
            .endTimeSlotId &&
        first.session.roomId ===
          second.session.roomId;

      if (
        !sameNumberedSession &&
        !samePlacement
      ) {
        continue;
      }

      conflicts.push(
        createConflict({
          type: 'duplicate_session',
          severity: 'blocked',
          message:
            sameNumberedSession
              ? 'The same numbered weekly session is registered more than once for this teaching allocation.'
              : 'The same teaching allocation has an identical timetable placement.',
          sessionIds: [
            first.session.id,
            second.session.id,
          ],
          workingDayId:
            first.session
              .workingDayId,
          resourceId:
            first.session
              .teachingAllocationId,
        }),
      );
    }
  }

  return conflicts;
}

function detectOverlapConflicts(
  contexts: SessionContext[],
): PlanningConflict[] {
  const conflicts: PlanningConflict[] = [];

  for (
    let firstIndex = 0;
    firstIndex < contexts.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex < contexts.length;
      secondIndex += 1
    ) {
      const first =
        contexts[firstIndex];

      const second =
        contexts[secondIndex];

      if (
        first.session.workingDayId !==
          second.session.workingDayId ||
        !first.interval ||
        !second.interval ||
        !timeIntervalsOverlap(
          first.interval,
          second.interval,
        )
      ) {
        continue;
      }

      const sessionIds = [
        first.session.id,
        second.session.id,
      ];

      if (
        first.session.trainerId !== null &&
        first.session.trainerId ===
        second.session.trainerId
      ) {
        conflicts.push(
          createConflict({
            type: 'trainer_overlap',
            severity: 'blocked',
            message:
              'The trainer has overlapping sessions.',
            sessionIds,
            resourceId:
              first.session.trainerId,
            resourceLabel:
              first.trainer?.fullName,
            workingDayId:
              first.session
                .workingDayId,
          }),
        );
      }

      const overlappingCohort =
        findOverlappingParticipantCohortId({
          firstCohortId:
            first.session.cohortId,
          firstParticipantCohortIds:
            first.session
              .participantCohortIds,
          secondCohortId:
            second.session.cohortId,
          secondParticipantCohortIds:
            second.session
              .participantCohortIds,
        });
      if (overlappingCohort) {
        conflicts.push(
          createConflict({
            type: 'cohort_overlap',
            severity: 'blocked',
            message:
              'The cohort has overlapping sessions.',
            sessionIds,
            resourceId:
              overlappingCohort,
            resourceLabel:
              first.cohort?.name,
            workingDayId:
              first.session
                .workingDayId,
          }),
        );
      }

      if (
        first.session.roomId !== null &&
        first.session.roomId ===
        second.session.roomId
      ) {
        conflicts.push(
          createConflict({
            type: 'room_overlap',
            severity: 'blocked',
            message:
              'The room has overlapping sessions.',
            sessionIds,
            resourceId:
              first.session.roomId,
            resourceLabel:
              first.room?.name,
            workingDayId:
              first.session
                .workingDayId,
          }),
        );
      }
    }
  }

  return conflicts;
}

function deduplicateConflicts(
  conflicts: PlanningConflict[],
): PlanningConflict[] {
  return Array.from(
    new Map(
      conflicts.map((conflict) => [
        conflict.id,
        conflict,
      ]),
    ).values(),
  );
}

export function detectTimetableConflicts(
  input: DetectTimetableConflictsInput,
): PlanningConflict[] {
  const contexts =
    resolveContexts(input);

  const conflicts = [
    ...contexts.flatMap(
      detectCalendarConflicts,
    ),
    ...contexts.flatMap(
      detectResourceAvailabilityConflicts,
    ),
    ...contexts.flatMap(
      detectRoomSuitabilityConflicts,
    ),
    ...contexts.flatMap((context) =>
      detectSchedulingConstraintConflicts(
        context,
        input.constraints ?? [],
      ),
    ),
    ...detectDuplicateConflicts(
      contexts,
    ),
    ...detectOverlapConflicts(
      contexts,
    ),
    ...detectTrainerWorkloadConflicts({
      sessions: input.sessions,
      trainers: input.trainers,
      workingDays: input.workingDays,
      timeSlots: input.timeSlots,
    }),
  ];

  return deduplicateConflicts(
    conflicts,
  ).sort((first, second) => {
    const severityOrder:
    Record<
      PlanningConflictSeverity,
      number
    > = {
      blocked: 0,
      error: 1,
      warning: 2,
    };

    return (
      severityOrder[first.severity] -
        severityOrder[second.severity] ||
      first.type.localeCompare(
        second.type,
      ) ||
      first.id.localeCompare(second.id)
    );
  });
}

export interface DetectCandidateConflictsInput {
  candidate: PlanningSession;
  existingSessions: PlanningSession[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  trainers: PlanningTrainer[];
  cohorts: PlanningCohort[];
  rooms: PlanningRoom[];
  units: PlanningUnit[];
  constraints?: PlanningConstraint[];
}

export function detectCandidateConflicts(
  input: DetectCandidateConflictsInput,
): PlanningConflict[] {
  const {
    candidate,
    existingSessions,
    workingDays,
    timeSlots,
    trainers,
    cohorts,
    rooms,
    units,
    constraints = [],
  } = input;

  const workingDaysMap = buildLookup(workingDays);
  const timeSlotsMap = buildLookup(timeSlots);
  const trainersMap = buildLookup(trainers);
  const cohortsMap = buildLookup(cohorts);
  const roomsMap = buildLookup(rooms);
  const unitsMap = buildLookup(units);

  const participantCohortIds = normalizeParticipantCohortIds({
    cohortId: candidate.cohortId,
    participantCohortIds: candidate.participantCohortIds,
  });

  const candidateContext: SessionContext = {
    session: candidate,
    workingDay: workingDaysMap.get(candidate.workingDayId),
    startTimeSlot: timeSlotsMap.get(candidate.startTimeSlotId),
    endTimeSlot: timeSlotsMap.get(candidate.endTimeSlotId),
    trainer: candidate.trainerId ? trainersMap.get(candidate.trainerId) : undefined,
    cohort: cohortsMap.get(candidate.cohortId),
    room: candidate.roomId ? roomsMap.get(candidate.roomId) : undefined,
    unit: unitsMap.get(candidate.unitId),
    participantCohortIds,
    unavailableParticipantCohortIds: participantCohortIds.filter((cohortId) => {
      const p = cohortsMap.get(cohortId);
      return !p || !p.isTimetableAvailable;
    }),
    requiredTimeSlotIds: [],
  };

  if (candidateContext.startTimeSlot && candidateContext.endTimeSlot) {
    candidateContext.requiredTimeSlotIds = timeSlots
      .filter(
        (slot) =>
          slot.academicPeriodId === candidate.academicPeriodId &&
          slot.isEnabled &&
          slot.slotType === 'teaching' &&
          slot.sequenceNumber >= candidateContext.startTimeSlot!.sequenceNumber &&
          slot.sequenceNumber <= candidateContext.endTimeSlot!.sequenceNumber,
      )
      .map((slot) => slot.id);

    try {
      candidateContext.interval = resolveSessionInterval({
        session: candidate,
        timeSlots: timeSlotsMap,
      });
    } catch {
      candidateContext.interval = undefined;
    }
  }

  const conflicts: PlanningConflict[] = [
    ...detectCalendarConflicts(candidateContext),
    ...detectResourceAvailabilityConflicts(candidateContext),
    ...detectRoomSuitabilityConflicts(candidateContext),
    ...detectSchedulingConstraintConflicts(candidateContext, constraints),
  ];

  for (const existing of existingSessions) {
    if (!isActiveSession(existing)) {
      continue;
    }

    const sameNumberedSession =
      existing.teachingAllocationId === candidate.teachingAllocationId &&
      existing.sessionNumber === candidate.sessionNumber;

    const samePlacement =
      existing.academicPeriodId === candidate.academicPeriodId &&
      existing.teachingAllocationId === candidate.teachingAllocationId &&
      existing.workingDayId === candidate.workingDayId &&
      existing.startTimeSlotId === candidate.startTimeSlotId &&
      existing.endTimeSlotId === candidate.endTimeSlotId &&
      existing.roomId === candidate.roomId;

    if (sameNumberedSession || samePlacement) {
      conflicts.push(
        createConflict({
          type: 'duplicate_session',
          severity: 'blocked',
          message: sameNumberedSession
            ? 'The same numbered weekly session is registered more than once for this teaching allocation.'
            : 'The same teaching allocation has an identical timetable placement.',
          sessionIds: [existing.id, candidate.id],
          workingDayId: candidate.workingDayId,
          resourceId: candidate.teachingAllocationId,
        }),
      );
    }

    if (
      existing.workingDayId !== candidate.workingDayId ||
      !candidateContext.interval
    ) {
      continue;
    }

    let existingInterval: TimeInterval | undefined;
    try {
      existingInterval = resolveSessionInterval({
        session: existing,
        timeSlots: timeSlotsMap,
      });
    } catch {
      continue;
    }

    if (
      !existingInterval ||
      !timeIntervalsOverlap(candidateContext.interval, existingInterval)
    ) {
      continue;
    }

    const sessionIds = [candidate.id, existing.id];

    if (
      candidate.trainerId !== null &&
      candidate.trainerId === existing.trainerId
    ) {
      conflicts.push(
        createConflict({
          type: 'trainer_overlap',
          severity: 'blocked',
          message: 'The trainer has overlapping sessions.',
          sessionIds,
          resourceId: candidate.trainerId,
          resourceLabel: candidateContext.trainer?.fullName,
          workingDayId: candidate.workingDayId,
        }),
      );
    }

    const overlappingCohort = findOverlappingParticipantCohortId({
      firstCohortId: candidate.cohortId,
      firstParticipantCohortIds: candidate.participantCohortIds,
      secondCohortId: existing.cohortId,
      secondParticipantCohortIds: existing.participantCohortIds,
    });

    if (overlappingCohort) {
      conflicts.push(
        createConflict({
          type: 'cohort_overlap',
          severity: 'blocked',
          message: 'The cohort has overlapping sessions.',
          sessionIds,
          resourceId: overlappingCohort,
          resourceLabel: candidateContext.cohort?.name,
          workingDayId: candidate.workingDayId,
        }),
      );
    }

    if (
      candidate.roomId !== null &&
      candidate.roomId === existing.roomId
    ) {
      conflicts.push(
        createConflict({
          type: 'room_overlap',
          severity: 'blocked',
          message: 'The room has overlapping sessions.',
          sessionIds,
          resourceId: candidate.roomId,
          resourceLabel: candidateContext.room?.name,
          workingDayId: candidate.workingDayId,
        }),
      );
    }
  }

  if (candidate.trainerId) {
    const targetTrainer = trainersMap.get(candidate.trainerId);
    if (targetTrainer) {
      const trainerRelevantSessions = [
        ...existingSessions.filter(
          (s) => isActiveSession(s) && s.trainerId === candidate.trainerId,
        ),
        candidate,
      ];
      const workloadConflicts = detectTrainerWorkloadConflicts({
        sessions: trainerRelevantSessions,
        trainers: [targetTrainer],
        workingDays,
        timeSlots,
      }).filter((conflict) => conflict.sessionIds.includes(candidate.id));
      conflicts.push(...workloadConflicts);
    }
  }

  return deduplicateConflicts(conflicts);
}
