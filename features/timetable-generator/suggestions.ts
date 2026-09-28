import {
  scorePlacements,
  type PlacementScoreResult,
} from './scorer';
import type {
  PlanningCohort,
  PlanningConstraint,
  PlanningRoom,
  PlanningSession,
  PlanningSuggestion,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningUnit,
  PlanningWorkingDay,
} from './types';

export interface SuggestAlternativePlacementsInput {
  conflictId: string;
  session: PlanningSession;
  candidates: PlanningSession[];
  existingSessions: PlanningSession[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  trainers: PlanningTrainer[];
  cohorts: PlanningCohort[];
  rooms: PlanningRoom[];
  units: PlanningUnit[];
  constraints?: PlanningConstraint[];
  limit?: number;
  minimumScore?: number;
}

export interface PlacementRecoverySuggestion
  extends PlanningSuggestion {
  candidate: PlanningSession;
  changes: Array<
    | 'working_day'
    | 'time'
    | 'room'
    | 'trainer'
  >;
  conflictCount: number;
  warningCount: number;
}

function createSuggestionId({
  conflictId,
  candidate,
}: {
  conflictId: string;
  candidate: PlanningSession;
}) {
  return [
    'suggestion',
    conflictId,
    candidate.workingDayId,
    candidate.startTimeSlotId,
    candidate.endTimeSlotId,
    candidate.roomId,
    candidate.trainerId,
  ].join(':');
}

function getChanges({
  original,
  candidate,
}: {
  original: PlanningSession;
  candidate: PlanningSession;
}): PlacementRecoverySuggestion['changes'] {
  const changes:
  PlacementRecoverySuggestion['changes'] =
    [];

  if (
    original.workingDayId !==
    candidate.workingDayId
  ) {
    changes.push('working_day');
  }

  if (
    original.startTimeSlotId !==
      candidate.startTimeSlotId ||
    original.endTimeSlotId !==
      candidate.endTimeSlotId
  ) {
    changes.push('time');
  }

  if (
    original.roomId !==
    candidate.roomId
  ) {
    changes.push('room');
  }

  if (
    original.trainerId !==
    candidate.trainerId
  ) {
    changes.push('trainer');
  }

  return changes;
}

function getSuggestionType(
  changes:
    PlacementRecoverySuggestion['changes'],
): PlanningSuggestion['type'] {
  if (
    changes.length === 1 &&
    changes[0] === 'room'
  ) {
    return 'change_room';
  }

  if (
    changes.length === 1 &&
    changes[0] === 'trainer'
  ) {
    return 'change_trainer';
  }

  if (
    changes.length === 1 &&
    changes[0] === 'working_day'
  ) {
    return 'change_day';
  }

  if (
    changes.length === 1 &&
    changes[0] === 'time'
  ) {
    return 'change_time';
  }

  return 'move_session';
}

function describeChanges({
  changes,
  candidate,
  workingDays,
  timeSlots,
  rooms,
  trainers,
}: {
  changes:
    PlacementRecoverySuggestion['changes'];
  candidate: PlanningSession;
  workingDays: Map<
    string,
    PlanningWorkingDay
  >;
  timeSlots: Map<
    string,
    PlanningTimeSlot
  >;
  rooms: Map<
    string,
    PlanningRoom
  >;
  trainers: Map<
    string,
    PlanningTrainer
  >;
}) {
  const parts: string[] = [];

  if (
    changes.includes('working_day')
  ) {
    const day =
      workingDays.get(
        candidate.workingDayId,
      );

    parts.push(
      `move to ${day?.dayOfWeek ?? 'another day'}`,
    );
  }

  if (changes.includes('time')) {
    const start =
      timeSlots.get(
        candidate.startTimeSlotId,
      );

    const end =
      timeSlots.get(
        candidate.endTimeSlotId,
      );

    parts.push(
      `use ${start?.startsAt ?? 'another start time'}–${
        end?.endsAt ?? 'another end time'
      }`,
    );
  }

  if (changes.includes('room')) {
    const room = candidate.roomId
      ? rooms.get(candidate.roomId)
      : undefined;

    parts.push(
      `use ${room?.name ?? 'no assigned room'}`,
    );
  }

  if (changes.includes('trainer')) {
    const trainer =
      trainers.get(
        candidate.trainerId,
      );

    parts.push(
      `assign ${trainer?.fullName ?? 'another trainer'}`,
    );
  }

  if (parts.length === 0) {
    return 'Keep the current placement.';
  }

  const sentence =
    parts.join(', ');

  return (
    sentence.charAt(0).toUpperCase() +
    sentence.slice(1) +
    '.'
  );
}

function removeCurrentSession({
  sessions,
  targetSessionId,
}: {
  sessions: PlanningSession[];
  targetSessionId: string;
}) {
  return sessions.filter(
    (session) =>
      session.id !== targetSessionId,
  );
}

function removeDuplicateCandidates(
  candidates: PlanningSession[],
) {
  const unique = new Map<
    string,
    PlanningSession
  >();

  for (const candidate of candidates) {
    const key = [
      candidate.workingDayId,
      candidate.startTimeSlotId,
      candidate.endTimeSlotId,
      candidate.roomId,
      candidate.trainerId,
    ].join(':');

    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(
    unique.values(),
  );
}

function scoreRecoveryCandidates({
  session,
  candidates,
  existingSessions,
  workingDays,
  timeSlots,
  trainers,
  cohorts,
  rooms,
  units,
  constraints,
}: Omit<
  SuggestAlternativePlacementsInput,
  | 'conflictId'
  | 'limit'
  | 'minimumScore'
>): PlacementScoreResult[] {
  const sessionsWithoutTarget =
    removeCurrentSession({
      sessions: existingSessions,
      targetSessionId: session.id,
    });

  return scorePlacements({
    candidates:
      removeDuplicateCandidates(
        candidates,
      ).filter(
        (candidate) =>
          candidate.id !== session.id,
      ),
    existingSessions:
      sessionsWithoutTarget,
    workingDays,
    timeSlots,
    trainers,
    cohorts,
    rooms,
    units,
    constraints,
  });
}

export function suggestAlternativePlacements({
  conflictId,
  session,
  candidates,
  existingSessions,
  workingDays,
  timeSlots,
  trainers,
  cohorts,
  rooms,
  units,
  constraints,
  limit = 5,
  minimumScore = 1,
}: SuggestAlternativePlacementsInput):
PlacementRecoverySuggestion[] {
  const workingDayLookup =
    new Map(
      workingDays.map((item) => [
        item.id,
        item,
      ]),
    );

  const timeSlotLookup =
    new Map(
      timeSlots.map((item) => [
        item.id,
        item,
      ]),
    );

  const roomLookup =
    new Map(
      rooms.map((item) => [
        item.id,
        item,
      ]),
    );

  const trainerLookup =
    new Map(
      trainers.map((item) => [
        item.id,
        item,
      ]),
    );

  return scoreRecoveryCandidates({
    session,
    candidates,
    existingSessions,
    workingDays,
    timeSlots,
    trainers,
    cohorts,
    rooms,
    units,
    constraints,
  })
    .filter(
      (result) =>
        result.isValid &&
        result.score >= minimumScore,
    )
    .map((result) => {
      const changes =
        getChanges({
          original: session,
          candidate:
            result.session,
        });

      const warningCount =
        result.conflicts.filter(
          (conflict) =>
            conflict.severity ===
            'warning',
        ).length;

      return {
        id: createSuggestionId({
          conflictId,
          candidate:
            result.session,
        }),
        conflictId,
        type:
          getSuggestionType(changes),
        message:
          describeChanges({
            changes,
            candidate:
              result.session,
            workingDays:
              workingDayLookup,
            timeSlots:
              timeSlotLookup,
            rooms: roomLookup,
            trainers:
              trainerLookup,
          }),
        score: result.score,
        proposedWorkingDayId:
          result.session.workingDayId,
        proposedStartTimeSlotId:
          result.session
            .startTimeSlotId,
        proposedEndTimeSlotId:
          result.session
            .endTimeSlotId,
        proposedRoomId:
          result.session.roomId,
        proposedTrainerId:
          result.session.trainerId,
        candidate:
          result.session,
        changes,
        conflictCount:
          result.conflicts.length,
        warningCount,
      };
    })
    .sort(
      (first, second) =>
        second.score -
          first.score ||
        first.warningCount -
          second.warningCount ||
        first.changes.length -
          second.changes.length ||
        first.id.localeCompare(
          second.id,
        ),
    )
    .slice(0, Math.max(0, limit));
}
