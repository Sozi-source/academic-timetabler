import {
  detectTimetableConflicts,
  detectCandidateConflicts,
  type DetectTimetableConflictsInput,
} from './conflict-detector';
import {
  resolveSessionInterval,
} from './session-time';
import {
  parseTimeToMinutes,
  resolveMinuteInterval,
} from './time';
import type {
  PlanningConflict,
  PlanningSession,
} from './types';
import {
  analyzeTrainerWorkloads,
} from './workload';

export type PlacementScoreFactor =
  | 'base'
  | 'blocked_conflict'
  | 'warning_conflict'
  | 'preferred_room'
  | 'room_capacity'
  | 'trainer_compactness'
  | 'trainer_workload'
  | 'morning_preference';

export interface PlacementScoreAdjustment {
  factor: PlacementScoreFactor;
  points: number;
  message: string;
}

export interface PlacementScoreResult {
  session: PlanningSession;
  score: number;
  isValid: boolean;
  conflicts: PlanningConflict[];
  adjustments: PlacementScoreAdjustment[];
}

export interface ScorePlacementInput
  extends Omit<
    DetectTimetableConflictsInput,
    'sessions'
  > {
  candidate: PlanningSession;
  existingSessions: PlanningSession[];
}

function clampScore(
  score: number,
) {
  return Math.max(
    0,
    Math.min(100, score),
  );
}

function buildLookup<T extends {
  id: string;
}>(
  values: T[],
) {
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

function getCandidateConflicts(input: ScorePlacementInput) {
  return detectCandidateConflicts(input);
}

function getRoomCapacityAdjustment({
  candidate,
  cohorts,
  rooms,
}: Pick<
  ScorePlacementInput,
  'candidate' | 'cohorts' | 'rooms'
>): PlacementScoreAdjustment {
  const cohort =
    cohorts.find(
      (item) =>
        item.id ===
        candidate.cohortId,
    );

  const room =
    rooms.find(
      (item) =>
        item.id ===
        candidate.roomId,
    );

  if (
    !cohort ||
    !room ||
    cohort.actualSize <= 0 ||
    room.capacity <= 0
  ) {
    return {
      factor: 'room_capacity',
      points: 0,
      message:
        'Room-capacity efficiency could not be calculated.',
    };
  }

  const requiredCapacity =
    candidate.combinedCohortSize ??
    cohort.actualSize;

  const utilization =
    requiredCapacity /
    room.capacity;

  if (utilization > 1) {
    return {
      factor: 'room_capacity',
      points: -20,
      message:
        'The room is too small for the cohort size.',
    };
  }

  if (utilization >= 0.7) {
    return {
      factor: 'room_capacity',
      points: 8,
      message:
        'The room is efficiently sized for the cohort.',
    };
  }

  if (utilization >= 0.5) {
    return {
      factor: 'room_capacity',
      points: 4,
      message:
        'The room has a reasonable capacity fit.',
    };
  }

  return {
    factor: 'room_capacity',
    points: -3,
    message:
      'The room is considerably larger than required.',
  };
}

function getPreferredRoomAdjustment({
  candidate,
  rooms,
  units,
}: Pick<
  ScorePlacementInput,
  'candidate' | 'rooms' | 'units'
>): PlacementScoreAdjustment {
  const unit =
    units.find(
      (item) =>
        item.id ===
        candidate.unitId,
    );

  const room =
    rooms.find(
      (item) =>
        item.id ===
        candidate.roomId,
    );

  if (
    !unit?.preferredRoomType ||
    !room
  ) {
    return {
      factor: 'preferred_room',
      points: 0,
      message:
        'The unit has no preferred room type.',
    };
  }

  if (
    room.roomType ===
    unit.preferredRoomType
  ) {
    return {
      factor: 'preferred_room',
      points: 10,
      message:
        'The placement uses the unit preferred room type.',
    };
  }

  return {
    factor: 'preferred_room',
    points: -10,
    message:
      'The room does not match the unit preferred room type.',
  };
}

function getTrainerCompactnessAdjustment({
  candidate,
  existingSessions,
  timeSlots,
}: Pick<
  ScorePlacementInput,
  | 'candidate'
  | 'existingSessions'
  | 'timeSlots'
>): PlacementScoreAdjustment {
  if (!candidate.trainerId) {
    return {
      factor: 'trainer_compactness',
      points: 0,
      message:
        'Trainer timetable compactness will be calculated after assignment.',
    };
  }

  const timeSlotLookup =
    buildLookup(timeSlots);

  let candidateInterval;

  try {
    candidateInterval =
      resolveMinuteInterval(
        resolveSessionInterval({
          session: candidate,
          timeSlots:
            timeSlotLookup,
        }),
      );
  }
  catch {
    return {
      factor:
        'trainer_compactness',
      points: 0,
      message:
        'Trainer timetable compactness could not be calculated.',
    };
  }

  const sameDaySessions =
    existingSessions.filter(
      (session) =>
        isActiveSession(session) &&
        session.trainerId ===
          candidate.trainerId &&
        session.workingDayId ===
          candidate.workingDayId,
    );

  if (
    sameDaySessions.length === 0
  ) {
    return {
      factor:
        'trainer_compactness',
      points: 1,
      message:
        'This begins a new teaching day for the trainer.',
    };
  }

  const gaps: number[] = [];

  for (
    const session of
    sameDaySessions
  ) {
    try {
      const interval =
        resolveMinuteInterval(
          resolveSessionInterval({
            session,
            timeSlots:
              timeSlotLookup,
          }),
        );

      if (
        candidateInterval.endMinutes <=
        interval.startMinutes
      ) {
        gaps.push(
          interval.startMinutes -
          candidateInterval.endMinutes,
        );
      }
      else if (
        interval.endMinutes <=
        candidateInterval.startMinutes
      ) {
        gaps.push(
          candidateInterval.startMinutes -
          interval.endMinutes,
        );
      }
    }
    catch {
      continue;
    }
  }

  if (gaps.length === 0) {
    return {
      factor:
        'trainer_compactness',
      points: 0,
      message:
        'No non-overlapping trainer gap was available for scoring.',
    };
  }

  const nearestGap =
    Math.min(...gaps);

  if (nearestGap === 0) {
    return {
      factor:
        'trainer_compactness',
      points: 8,
      message:
        'The placement is adjacent to another trainer session.',
    };
  }

  if (nearestGap <= 60) {
    return {
      factor:
        'trainer_compactness',
      points: 4,
      message:
        'The placement keeps the trainer timetable reasonably compact.',
    };
  }

  if (nearestGap <= 120) {
    return {
      factor:
        'trainer_compactness',
      points: 0,
      message:
        'The placement creates a moderate trainer gap.',
    };
  }

  return {
    factor:
      'trainer_compactness',
    points: -6,
    message:
      'The placement creates a large trainer idle gap.',
  };
}

function getTrainerWorkloadAdjustment({
  candidate,
  existingSessions,
  trainers,
  workingDays,
  timeSlots,
}: Pick<
  ScorePlacementInput,
  | 'candidate'
  | 'existingSessions'
  | 'trainers'
  | 'workingDays'
  | 'timeSlots'
>): PlacementScoreAdjustment {
  if (!candidate.trainerId) {
    return {
      factor: 'trainer_workload',
      points: 0,
      message: 'Trainer workload balance could not be calculated.',
    };
  }

  const targetTrainer = trainers.find((t) => t.id === candidate.trainerId);
  if (!targetTrainer || targetTrainer.normalWeeklyHours <= 0) {
    return {
      factor: 'trainer_workload',
      points: 0,
      message: 'Trainer workload balance could not be calculated.',
    };
  }

  const relevantSessions = [
    ...existingSessions.filter(
      (s) => isActiveSession(s) && s.trainerId === candidate.trainerId,
    ),
    candidate,
  ];

  const analysis =
    analyzeTrainerWorkloads({
      sessions: relevantSessions,
      trainers: [targetTrainer],
      workingDays,
      timeSlots,
    }).find(
      (item) =>
        item.trainerId ===
        candidate.trainerId,
    );

  if (
    !analysis ||
    analysis.normalWeeklyHours <= 0
  ) {
    return {
      factor:
        'trainer_workload',
      points: 0,
      message:
        'Trainer workload balance could not be calculated.',
    };
  }

  const utilization =
    analysis.weeklyTeachingHours /
    analysis.normalWeeklyHours;

  if (utilization <= 0.7) {
    return {
      factor:
        'trainer_workload',
      points: 6,
      message:
        'The trainer remains comfortably within the weekly workload target.',
    };
  }

  if (utilization <= 0.9) {
    return {
      factor:
        'trainer_workload',
      points: 3,
      message:
        'The trainer remains within a balanced weekly workload.',
    };
  }

  if (utilization <= 1) {
    return {
      factor:
        'trainer_workload',
      points: -2,
      message:
        'The trainer is approaching the weekly workload target.',
    };
  }

  return {
    factor:
      'trainer_workload',
    points: -15,
    message:
      'The placement adds extra hours above the trainer weekly target.',
  };
}

function getMorningAdjustment({
  candidate,
  timeSlots,
}: Pick<
  ScorePlacementInput,
  'candidate' | 'timeSlots'
>): PlacementScoreAdjustment {
  const slot =
    timeSlots.find(
      (item) =>
        item.id ===
        candidate.startTimeSlotId,
    );

  if (!slot) {
    return {
      factor:
        'morning_preference',
      points: 0,
      message:
        'The session start time could not be resolved.',
    };
  }

  const startMinutes =
    parseTimeToMinutes(
      slot.startsAt,
    );

  if (startMinutes < 12 * 60) {
    return {
      factor:
        'morning_preference',
      points: 3,
      message:
        'The placement uses a morning teaching slot.',
    };
  }

  if (startMinutes >= 16 * 60) {
    return {
      factor:
        'morning_preference',
      points: -2,
      message:
        'The placement uses a late-afternoon slot.',
    };
  }

  return {
    factor:
      'morning_preference',
    points: 0,
    message:
      'The placement uses a standard afternoon slot.',
  };
}

export function scorePlacement(
  input: ScorePlacementInput,
): PlacementScoreResult {
  const conflicts =
    getCandidateConflicts(input);

  const blockedConflicts =
    conflicts.filter(
      (conflict) =>
        conflict.severity ===
        'blocked',
    );

  const warningConflicts =
    conflicts.filter(
      (conflict) =>
        conflict.severity ===
        'warning',
    );

  const adjustments:
  PlacementScoreAdjustment[] = [
    {
      factor: 'base',
      points: 70,
      message:
        'Base placement quality score.',
    },
  ];

  if (
    blockedConflicts.length > 0
  ) {
    adjustments.push({
      factor:
        'blocked_conflict',
      points:
        -100 *
        blockedConflicts.length,
      message:
        `${blockedConflicts.length} blocking conflict${
          blockedConflicts.length === 1
            ? ''
            : 's'
        } detected.`,
    });
  }

  if (
    warningConflicts.length > 0
  ) {
    adjustments.push({
      factor:
        'warning_conflict',
      points:
        -8 *
        warningConflicts.length,
      message:
        `${warningConflicts.length} warning${
          warningConflicts.length === 1
            ? ''
            : 's'
        } detected.`,
    });
  }

  adjustments.push(
    getPreferredRoomAdjustment(
      input,
    ),
    getRoomCapacityAdjustment(
      input,
    ),
    getTrainerCompactnessAdjustment(
      input,
    ),
    getTrainerWorkloadAdjustment(
      input,
    ),
    getMorningAdjustment(input),
  );

  const score = clampScore(
    adjustments.reduce(
      (total, adjustment) =>
        total +
        adjustment.points,
      0,
    ),
  );

  return {
    session: input.candidate,
    score,
    isValid:
      blockedConflicts.length === 0,
    conflicts,
    adjustments,
  };
}

export function scorePlacements({
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
  ScorePlacementInput,
  'candidate'
> & {
  candidates: PlanningSession[];
}): PlacementScoreResult[] {
  return candidates
    .map((candidate) =>
      scorePlacement({
        candidate,
        existingSessions,
        workingDays,
        timeSlots,
        trainers,
        cohorts,
        rooms,
        units,
        constraints,
      }),
    )
    .sort(
      (first, second) =>
        Number(second.isValid) -
          Number(first.isValid) ||
        second.score -
          first.score ||
        first.session.id.localeCompare(
          second.session.id,
        ),
    );
}
