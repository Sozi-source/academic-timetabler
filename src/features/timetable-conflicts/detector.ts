import type {
  ConflictAvailabilityContext,
  ConflictConstraint,
  ConflictReview,
  ConflictSession,
  TimetableConflict,
} from './types';
import {
  findOverlappingParticipantCohortId,
  normalizeParticipantCohortIds,
} from '@/features/timetable-generator/participant-cohorts';

function minutes(value: string) {
  const [hour = '0', minute = '0'] = value.slice(0, 5).split(':');
  return Number(hour) * 60 + Number(minute);
}

function overlaps(a: ConflictSession, b: ConflictSession) {
  return minutes(a.startTime) < minutes(b.endTime) &&
    minutes(b.startTime) < minutes(a.endTime);
}

function samePlacement(a: ConflictSession, b: ConflictSession) {
  return a.workingDayId === b.workingDayId && overlaps(a, b);
}

function compatibleSharedClass(a: ConflictSession, b: ConflictSession) {
  return a.unitName.trim().toLowerCase() === b.unitName.trim().toLowerCase() &&
    a.trainerId !== null &&
    a.trainerId === b.trainerId &&
    a.roomId === b.roomId &&
    a.startTimeSlotId === b.startTimeSlotId &&
    a.endTimeSlotId === b.endTimeSlotId;
}

function participantCohorts(
  session: ConflictSession,
) {
  return normalizeParticipantCohortIds({
    cohortId: session.cohortId,
    participantCohortIds:
      session.participantCohortIds,
  });
}

function stableKey(kind: string, sessionIds: string[], suffix = '') {
  return [kind, ...[...sessionIds].sort(), suffix].filter(Boolean).join(':');
}

function reviewFor(key: string, reviews: Map<string, ConflictReview>) {
  return reviews.get(key) ?? null;
}

function pairConflict(
  kind: TimetableConflict['kind'],
  severity: TimetableConflict['severity'],
  title: string,
  message: string,
  a: ConflictSession,
  b: ConflictSession,
  resourceLabel: string,
  reviews: Map<string, ConflictReview>,
): TimetableConflict {
  const key = stableKey(kind, [a.id, b.id]);
  return {
    key,
    kind,
    severity,
    title,
    message,
    sessionIds: [a.id, b.id],
    resourceLabel,
    workingDayLabel: a.workingDayLabel,
    timeLabel: `${a.startTime.slice(0, 5)}–${a.endTime.slice(0, 5)}`,
    isLocked: a.isLocked || b.isLocked,
    review: reviewFor(key, reviews),
  };
}

function constraintSubjectMatches(session: ConflictSession, constraint: ConflictConstraint) {
  if (constraint.subjectType === 'trainer' && constraint.subjectId !== session.trainerId) return false;
  if (constraint.subjectType === 'room' && constraint.subjectId !== session.roomId) return false;
  if (
    constraint.subjectType === 'cohort' &&
    (
      !constraint.subjectId ||
      !participantCohorts(session).includes(
        constraint.subjectId,
      )
    )
  ) return false;
  return true;
}

function constraintWindowOverlaps(session: ConflictSession, constraint: ConflictConstraint) {
  if (constraint.workingDayId && constraint.workingDayId !== session.workingDayId) return false;
  if (!constraint.startsAt || !constraint.endsAt) return true;
  return minutes(session.startTime) < minutes(constraint.endsAt) &&
    minutes(constraint.startsAt) < minutes(session.endTime);
}

function constraintWindowContains(session: ConflictSession, constraint: ConflictConstraint) {
  if (constraint.workingDayId && constraint.workingDayId !== session.workingDayId) return false;
  if (!constraint.startsAt || !constraint.endsAt) return true;
  return minutes(session.startTime) >= minutes(constraint.startsAt) &&
    minutes(session.endTime) <= minutes(constraint.endsAt);
}

function constraintConflict(
  session: ConflictSession,
  constraints: ConflictConstraint[],
  reviews: Map<string, ConflictReview>,
) {
  const first = constraints[0];
  const kind = first.priority === 'hard' ? 'hard_constraint' : 'soft_constraint';
  const reasons = Array.from(new Set(
    constraints.map((constraint) => constraint.reason.trim()),
  )).filter(Boolean);
  const key = stableKey(kind, [session.id], constraints.map((constraint) => constraint.id).sort().join(','));
  const positive = ['preferred', 'required'].includes(first.constraintType);
  return {
    key,
    kind,
    severity: first.priority === 'hard' ? 'blocked' : 'warning',
    title: first.priority === 'hard' ? 'Hard constraint violated' : 'Scheduling preference violated',
    message: positive
      ? `The session is outside the configured ${first.constraintType} window: ${reasons.join('; ')}.`
      : `The session violates a configured ${first.constraintType} rule: ${reasons.join('; ')}.`,
    sessionIds: [session.id],
    resourceLabel: session.unitName,
    workingDayLabel: session.workingDayLabel,
    timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
    isLocked: session.isLocked,
    review: reviewFor(key, reviews),
  } satisfies TimetableConflict;
}

function workloadConflict({
  kind,
  severity,
  title,
  message,
  sessions,
  suffix,
  reviews,
}: {
  kind: 'trainer_daily_workload' | 'trainer_weekly_workload';
  severity: 'blocked' | 'warning';
  title: string;
  message: string;
  sessions: ConflictSession[];
  suffix: string;
  reviews: Map<string, ConflictReview>;
}): TimetableConflict {
  const sessionIds = sessions.map((session) => session.id);
  const key = stableKey(kind, sessionIds, suffix);
  const first = sessions[0];
  const totalMinutes = sessions.reduce(
    (total, session) => total + minutes(session.endTime) - minutes(session.startTime),
    0,
  );

  return {
    key,
    kind,
    severity,
    title,
    message,
    sessionIds,
    resourceLabel: first.trainerName,
    workingDayLabel: kind === 'trainer_daily_workload'
      ? first.workingDayLabel
      : 'Weekly total',
    timeLabel: `${(totalMinutes / 60).toFixed(1)} hours`,
    isLocked: sessions.some((session) => session.isLocked),
    review: reviewFor(key, reviews),
  };
}

function detectWorkloadConflicts(
  sessions: ConflictSession[],
  reviews: Map<string, ConflictReview>,
) {
  const conflicts: TimetableConflict[] = [];
  const trainerGroups = new Map<string, ConflictSession[]>();
  const uniqueSessions = new Map<string, ConflictSession>();

  for (const session of sessions) {
    const key = [
      session.trainerId ?? 'unassigned',
      session.workingDayId,
      session.startTime,
      session.endTime,
      session.unitName.trim().toLowerCase(),
      session.roomId ?? 'unassigned-room',
    ].join('|');
    if (!uniqueSessions.has(key)) uniqueSessions.set(key, session);
  }

  for (const session of uniqueSessions.values()) {
    if (!session.trainerId) continue;
    const group = trainerGroups.get(session.trainerId) ?? [];
    group.push(session);
    trainerGroups.set(session.trainerId, group);
  }

  for (const trainerSessions of trainerGroups.values()) {
    const first = trainerSessions[0];
    const dayGroups = new Map<string, ConflictSession[]>();

    for (const session of trainerSessions) {
      const group = dayGroups.get(session.workingDayId) ?? [];
      group.push(session);
      dayGroups.set(session.workingDayId, group);
    }

    for (const daySessions of dayGroups.values()) {
      const dailyMinutes = daySessions.reduce(
        (total, session) => total + minutes(session.endTime) - minutes(session.startTime),
        0,
      );
      const approvedFullDayOnly = daySessions.length === 1 &&
        daySessions[0].isFullDaySession;

      if (
        !approvedFullDayOnly &&
        first.trainerMaximumDailyHours > 0 &&
        dailyMinutes > first.trainerMaximumDailyHours * 60
      ) {
        conflicts.push(workloadConflict({
          kind: 'trainer_daily_workload',
          severity: 'blocked',
          title: 'Trainer daily workload exceeded',
          message: `${first.trainerName} has ${(dailyMinutes / 60).toFixed(1)} teaching hours on ${daySessions[0].workingDayLabel}, above the daily maximum of ${first.trainerMaximumDailyHours} hours.`,
          sessions: daySessions,
          suffix: daySessions[0].workingDayId,
          reviews,
        }));
      }
    }

    const weeklyMinutes = trainerSessions.reduce(
      (total, session) => total + minutes(session.endTime) - minutes(session.startTime),
      0,
    );

    if (
      first.trainerMaximumWeeklyHours > 0 &&
      weeklyMinutes > first.trainerMaximumWeeklyHours * 60
    ) {
      conflicts.push(workloadConflict({
        kind: 'trainer_weekly_workload',
        severity: 'blocked',
        title: 'Trainer weekly maximum exceeded',
        message: `${first.trainerName} has ${(weeklyMinutes / 60).toFixed(1)} weekly teaching hours, above the absolute maximum of ${first.trainerMaximumWeeklyHours} hours.`,
        sessions: trainerSessions,
        suffix: first.trainerId ?? 'trainer',
        reviews,
      }));
    }
    else if (
      first.trainerNormalWeeklyHours > 0 &&
      weeklyMinutes > first.trainerNormalWeeklyHours * 60
    ) {
      conflicts.push(workloadConflict({
        kind: 'trainer_weekly_workload',
        severity: 'warning',
        title: 'Trainer has extra weekly hours',
        message: `${first.trainerName} has ${(weeklyMinutes / 60).toFixed(1)} weekly teaching hours, above the normal target of ${first.trainerNormalWeeklyHours} hours but within the permitted maximum.`,
        sessions: trainerSessions,
        suffix: first.trainerId ?? 'trainer',
        reviews,
      }));
    }
  }

  return conflicts;
}

export function detectTimetableConflictCenter(
  sessions: ConflictSession[],
  constraints: ConflictConstraint[],
  reviewRows: ConflictReview[],
  availabilityContext: ConflictAvailabilityContext = {
    availableSlots: [],
    timeSlots: [],
  },
): TimetableConflict[] {
  const reviews = new Map(reviewRows.map((review) => [review.conflictKey, review]));
  const conflicts: TimetableConflict[] = [];
  const availability = new Set(
    availabilityContext.availableSlots.map((slot) =>
      `${slot.trainerId}:${slot.workingDayId}:${slot.timeSlotId}`,
    ),
  );
  const timeSlotDirectory = new Map(
    availabilityContext.timeSlots.map((slot) => [slot.id, slot]),
  );

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];

    if (!session.trainerId) {
      const key = stableKey('trainer_pending', [session.id]);
      conflicts.push({
        key,
        kind: 'trainer_pending',
        severity: 'warning',
        title: 'Trainer assignment pending',
        message: `${session.unitCode} · ${session.unitName} is reserved and will be published as UNASSIGNED unless a trainer is assigned.`,
        sessionIds: [session.id],
        resourceLabel: session.unitName,
        workingDayLabel: session.workingDayLabel,
        timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
        isLocked: session.isLocked,
        review: reviewFor(key, reviews),
      });
    }
    else if (session.trainerAvailabilityMode === 'selected_slots_only') {
      const startSlot = timeSlotDirectory.get(session.startTimeSlotId);
      const endSlot = timeSlotDirectory.get(session.endTimeSlotId);
      const requiredSlots = startSlot && endSlot
        ? availabilityContext.timeSlots.filter((slot) => (
            slot.isEnabled
            && slot.slotType === 'teaching'
            && slot.sequenceNumber >= startSlot.sequenceNumber
            && slot.sequenceNumber <= endSlot.sequenceNumber
          ))
        : [];
      const unavailable = requiredSlots.some((slot) => !availability.has(
        `${session.trainerId}:${session.workingDayId}:${slot.id}`,
      ));

      if (unavailable) {
        const key = stableKey('trainer_availability', [session.id], session.trainerId);
        conflicts.push({
          key,
          kind: 'trainer_availability',
          severity: 'blocked',
          title: 'Trainer is outside selected availability',
          message: `${session.trainerName} is not available for every required teaching period on ${session.workingDayLabel}.`,
          sessionIds: [session.id],
          resourceLabel: session.trainerName,
          workingDayLabel: session.workingDayLabel,
          timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
          isLocked: session.isLocked,
          review: reviewFor(key, reviews),
        });
      }
    }

    if (!session.roomId) {
      const key = stableKey('room_pending', [session.id]);
      conflicts.push({
        key,
        kind: 'room_pending',
        severity: 'warning',
        title: 'Room assignment pending',
        message: `${session.unitCode} · ${session.unitName} has no room assigned. This does not block the timetable.`,
        sessionIds: [session.id],
        resourceLabel: session.unitName,
        workingDayLabel: session.workingDayLabel,
        timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
        isLocked: session.isLocked,
        review: reviewFor(key, reviews),
      });
    }

    const requiredRoomCapacity =
      session.combinedCohortSize > 0
        ? session.combinedCohortSize
        : session.cohortSize;

    if (session.roomId && session.roomCapacity < requiredRoomCapacity) {
      const key = stableKey('room_capacity', [session.id], session.roomId);
      conflicts.push({
        key,
        kind: 'room_capacity',
        severity: 'blocked',
        title: 'Room capacity is insufficient',
        message: `${session.roomName} holds ${session.roomCapacity}, but ${session.cohortName} requires capacity for ${requiredRoomCapacity} learners.`,
        sessionIds: [session.id],
        resourceLabel: session.roomName,
        workingDayLabel: session.workingDayLabel,
        timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
        isLocked: session.isLocked,
        review: reviewFor(key, reviews),
      });
    }

    if (session.conflictState === 'blocked' || session.conflictState === 'warning') {
      const key = stableKey('session_state', [session.id], session.conflictState);
      conflicts.push({
        key,
        kind: 'session_state',
        severity: session.conflictState === 'blocked' ? 'blocked' : 'warning',
        title: 'Session requires review',
        message: `${session.unitCode} · ${session.unitName} is marked ${session.conflictState} by database validation.`,
        sessionIds: [session.id],
        resourceLabel: session.unitName,
        workingDayLabel: session.workingDayLabel,
        timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
        isLocked: session.isLocked,
        review: reviewFor(key, reviews),
      });
    }

    const relevantConstraints = constraints.filter((constraint) =>
      constraintSubjectMatches(session, constraint),
    );

    for (const constraint of relevantConstraints.filter((item) =>
      ['unavailable', 'protected_day'].includes(item.constraintType),
    )) {
      if (constraintWindowOverlaps(session, constraint)) {
        conflicts.push(constraintConflict(session, [constraint], reviews));
      }
    }

    const positiveGroups = new Map<string, ConflictConstraint[]>();
    for (const constraint of relevantConstraints.filter((item) =>
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
        constraintWindowContains(session, constraint),
      )) {
        conflicts.push(constraintConflict(session, group, reviews));
      }
    }

    for (let secondIndex = index + 1; secondIndex < sessions.length; secondIndex += 1) {
      const other = sessions[secondIndex];
      if (!samePlacement(session, other) || compatibleSharedClass(session, other)) continue;

      if (session.trainerId !== null && session.trainerId === other.trainerId) {
        conflicts.push(pairConflict(
          'trainer_overlap', 'blocked', 'Trainer double-booking',
          `${session.trainerName} is assigned to ${session.unitCode} and ${other.unitCode} at the same time.`,
          session, other, session.trainerName, reviews,
        ));
      }
      const overlappingCohortId =
        findOverlappingParticipantCohortId({
          firstCohortId:
            session.cohortId,
          firstParticipantCohortIds:
            session.participantCohortIds,
          secondCohortId:
            other.cohortId,
          secondParticipantCohortIds:
            other.participantCohortIds,
        });

      if (overlappingCohortId) {
        conflicts.push(pairConflict(
          'cohort_overlap', 'blocked', 'Cohort double-booking',
          `${session.cohortName} has two sessions at the same time.`,
          session, other,
          overlappingCohortId === session.cohortId
            ? session.cohortName
            : 'Shared cohort',
          reviews,
        ));
      }
      if (session.roomId !== null && session.roomId === other.roomId) {
        conflicts.push(pairConflict(
          'room_overlap', 'blocked', 'Room double-booking',
          `${session.roomName} is assigned to two different classes at the same time.`,
          session, other, session.roomName, reviews,
        ));
      }
    }
  }

  conflicts.push(...detectWorkloadConflicts(sessions, reviews));

  const unique = new Map<string, TimetableConflict>();
  for (const conflict of conflicts) unique.set(conflict.key, conflict);
  return [...unique.values()].sort((a, b) => {
    const rank = { blocked: 0, error: 1, warning: 2 } as const;
    return rank[a.severity] - rank[b.severity] || a.workingDayLabel.localeCompare(b.workingDayLabel);
  });
}
