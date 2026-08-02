import type {
  PlanningRoom,
  PlanningSession,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningWorkingDay,
} from './types';

export interface CreatePlacementCandidatesInput {
  session: PlanningSession;
  workingDays: PlanningWorkingDay[];
  timeRanges: Array<{
    startTimeSlotId: string;
    endTimeSlotId: string;
  }>;
  rooms: PlanningRoom[];
  trainers?: PlanningTrainer[];
}

export function createPlacementCandidates({
  session,
  workingDays,
  timeRanges,
  rooms,
  trainers,
}: CreatePlacementCandidatesInput):
PlanningSession[] {
  const availableDays =
    workingDays.filter(
      (day) =>
        day.isEnabled &&
        day.academicPeriodId ===
          session.academicPeriodId,
    );

  const availableRooms =
    rooms.filter(
      (room) =>
        room.isActive &&
        room.isTimetableAvailable,
    );

  const availableTrainers =
    trainers?.filter(
      (trainer) =>
        trainer.isActive &&
        trainer.isTimetableAvailable,
    ) ?? [
      {
        id: session.trainerId,
      },
    ];

  const candidates:
  PlanningSession[] = [];

  for (const day of availableDays) {
    for (const range of timeRanges) {
      for (const room of availableRooms) {
        for (
          const trainer of
          availableTrainers
        ) {
          const candidateId = [
            'recovery',
            session.id,
            day.id,
            range.startTimeSlotId,
            range.endTimeSlotId,
            room.id,
            trainer.id,
          ].join(':');

          candidates.push({
            ...session,
            id: candidateId,
            workingDayId: day.id,
            startTimeSlotId:
              range.startTimeSlotId,
            endTimeSlotId:
              range.endTimeSlotId,
            roomId: room.id,
            trainerId: trainer.id,
            source: 'reschedule',
            conflictState:
              'unchecked',
            isLocked: false,
            status: 'draft',
          });
        }
      }
    }
  }

  return candidates;
}

export function createTimeRangesFromSlots(
  timeSlots: PlanningTimeSlot[],
) {
  return timeSlots
    .filter(
      (slot) =>
        slot.isEnabled &&
        slot.slotType ===
          'teaching',
    )
    .map((slot) => ({
      startTimeSlotId: slot.id,
      endTimeSlotId: slot.id,
    }));
}