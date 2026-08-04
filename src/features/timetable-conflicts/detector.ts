import type {
  ConflictConstraint,
  ConflictReview,
  ConflictSession,
  TimetableConflict,
} from './types';

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
    a.trainerId === b.trainerId &&
    a.roomId === b.roomId &&
    a.startTimeSlotId === b.startTimeSlotId &&
    a.endTimeSlotId === b.endTimeSlotId;
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

function constraintApplies(session: ConflictSession, constraint: ConflictConstraint) {
  if (constraint.workingDayId && constraint.workingDayId !== session.workingDayId) return false;
  if (constraint.subjectType === 'trainer' && constraint.subjectId !== session.trainerId) return false;
  if (constraint.subjectType === 'room' && constraint.subjectId !== session.roomId) return false;
  if (constraint.subjectType === 'cohort' && constraint.subjectId !== session.cohortId) return false;
  if (!constraint.startsAt || !constraint.endsAt) return true;
  return minutes(session.startTime) < minutes(constraint.endsAt) &&
    minutes(constraint.startsAt) < minutes(session.endTime);
}

export function detectTimetableConflictCenter(
  sessions: ConflictSession[],
  constraints: ConflictConstraint[],
  reviewRows: ConflictReview[],
): TimetableConflict[] {
  const reviews = new Map(reviewRows.map((review) => [review.conflictKey, review]));
  const conflicts: TimetableConflict[] = [];

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];

    if (session.roomCapacity < session.cohortSize) {
      const key = stableKey('room_capacity', [session.id], session.roomId);
      conflicts.push({
        key,
        kind: 'room_capacity',
        severity: 'blocked',
        title: 'Room capacity is insufficient',
        message: `${session.roomName} holds ${session.roomCapacity}, but ${session.cohortName} has ${session.cohortSize} learners.`,
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

    for (const constraint of constraints) {
      if (!constraintApplies(session, constraint)) continue;
      if (!['unavailable', 'protected_day'].includes(constraint.constraintType)) continue;
      const kind = constraint.priority === 'hard' ? 'hard_constraint' : 'soft_constraint';
      const key = stableKey(kind, [session.id], constraint.id);
      conflicts.push({
        key,
        kind,
        severity: constraint.priority === 'hard' ? 'blocked' : 'warning',
        title: constraint.priority === 'hard' ? 'Hard constraint violated' : 'Scheduling preference violated',
        message: constraint.reason,
        sessionIds: [session.id],
        resourceLabel: session.unitName,
        workingDayLabel: session.workingDayLabel,
        timeLabel: `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`,
        isLocked: session.isLocked,
        review: reviewFor(key, reviews),
      });
    }

    for (let secondIndex = index + 1; secondIndex < sessions.length; secondIndex += 1) {
      const other = sessions[secondIndex];
      if (!samePlacement(session, other) || compatibleSharedClass(session, other)) continue;

      if (session.trainerId === other.trainerId) {
        conflicts.push(pairConflict(
          'trainer_overlap', 'blocked', 'Trainer double-booking',
          `${session.trainerName} is assigned to ${session.unitCode} and ${other.unitCode} at the same time.`,
          session, other, session.trainerName, reviews,
        ));
      }
      if (session.cohortId === other.cohortId) {
        conflicts.push(pairConflict(
          'cohort_overlap', 'blocked', 'Cohort double-booking',
          `${session.cohortName} has two sessions at the same time.`,
          session, other, session.cohortName, reviews,
        ));
      }
      if (session.roomId === other.roomId) {
        conflicts.push(pairConflict(
          'room_overlap', 'blocked', 'Room double-booking',
          `${session.roomName} is assigned to two different classes at the same time.`,
          session, other, session.roomName, reviews,
        ));
      }
    }
  }

  const unique = new Map<string, TimetableConflict>();
  for (const conflict of conflicts) unique.set(conflict.key, conflict);
  return [...unique.values()].sort((a, b) => {
    const rank = { blocked: 0, error: 1, warning: 2 } as const;
    return rank[a.severity] - rank[b.severity] || a.workingDayLabel.localeCompare(b.workingDayLabel);
  });
}
