import type {
  PlanningSession,
  PlanningTimeSlot,
  TimeInterval,
} from './types';

export interface SessionTimeSlotLookup {
  get(
    id: string,
  ): PlanningTimeSlot | undefined;
}

export function resolveSessionInterval({
  session,
  timeSlots,
}: {
  session: PlanningSession;
  timeSlots: SessionTimeSlotLookup;
}): TimeInterval {
  const startSlot =
    timeSlots.get(
      session.startTimeSlotId,
    );

  if (!startSlot) {
    throw new Error(
      `Start time slot "${session.startTimeSlotId}" was not found for session "${session.id}".`,
    );
  }

  const endSlot =
    timeSlots.get(
      session.endTimeSlotId,
    );

  if (!endSlot) {
    throw new Error(
      `End time slot "${session.endTimeSlotId}" was not found for session "${session.id}".`,
    );
  }

  return {
    startsAt: startSlot.startsAt,
    endsAt: endSlot.endsAt,
  };
}

export function createTimeSlotLookup(
  timeSlots: PlanningTimeSlot[],
): Map<string, PlanningTimeSlot> {
  return new Map(
    timeSlots.map((timeSlot) => [
      timeSlot.id,
      timeSlot,
    ]),
  );
}