import 'server-only';

import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import type {
  Cohort,
} from '@/features/cohorts/types';
import type {
  Room,
} from '@/features/rooms/types';
import type {
  TeachingAllocation,
} from '@/features/teaching-allocations/types';
import type {
  TimeSlot,
  WorkingDay,
} from '@/features/timetable-calendar/types';
import type {
  Trainer,
} from '@/features/trainers/types';
import type {
  Unit,
} from '@/features/units/types';

import {
  generateTimetablePlan,
  type AutomaticPlannerInput,
  type AutomaticPlannerResult,
} from './planner';
import type {
  GeneratorAcademicPeriodSummary,
  GeneratorConflictSummary,
  GeneratorPreview,
  GeneratorPreviewSession,
  GeneratorReadinessSummary,
  GeneratorUnscheduledSession,
  ExistingScheduledSessionRow,
} from './server-types';
import {
  getIntervalDurationMinutes,
} from './time';
import type {
  PlanningAllocation,
  PlanningCohort,
  PlanningConflict,
  PlanningRoom,
  PlanningSession,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningUnit,
  PlanningWorkingDay,
} from './types';
import type {
  GeneratorSourceData,
} from './queries';

export interface CreateGeneratorPreviewOptions {
  overwriteExisting?: boolean;
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

function mapAcademicPeriod(
  period: AcademicPeriod,
): GeneratorAcademicPeriodSummary {
  return {
    id: period.id,
    code: period.code,
    name: period.name,
    status: period.status,
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    teachingStartsOn:
      period.teachingStartsOn,
    teachingEndsOn:
      period.teachingEndsOn,
  };
}

function mapAllocation(
  allocation: TeachingAllocation,
): PlanningAllocation {
  return {
    id: allocation.id,
    academicPeriodId:
      allocation.academicPeriodId,
    cohortId:
      allocation.cohortId,
    unitId:
      allocation.unitId,
    trainerId:
      allocation.trainerId,
    preferredRoomId:
      allocation.preferredRoomId,
    deliveryMode:
      allocation.deliveryMode,
    weeklySessions:
      allocation.weeklySessions,
    sessionDurationMinutes:
      allocation.sessionDurationMinutes,
    isTimetableEnabled:
      allocation.isTimetableEnabled,
  };
}

function mapTrainer(
  trainer: Trainer,
): PlanningTrainer {
  return {
    id: trainer.id,
    staffNumber:
      trainer.staffNumber,
    fullName:
      trainer.fullName,
    maximumWeeklyHours:
      trainer.maximumWeeklyHours,
    maximumDailyHours:
      trainer.maximumDailyHours,
    isActive:
      trainer.isActive,
    isTimetableAvailable:
      trainer.isTimetableAvailable,
  };
}

function mapCohort(
  cohort: Cohort,
): PlanningCohort {
  return {
    id: cohort.id,
    code: cohort.code,
    name: cohort.name,
    actualSize:
      cohort.actualSize,
    isTimetableAvailable:
      cohort.isTimetableAvailable,
  };
}

function mapRoom(
  room: Room,
): PlanningRoom {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    roomType:
      room.roomType,
    capacity:
      room.capacity,
    isActive:
      room.isActive,
    isTimetableAvailable:
      room.isTimetableAvailable,
  };
}

function mapUnit(
  unit: Unit,
): PlanningUnit {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    preferredRoomType:
      unit.preferredRoomType,
    isActive:
      unit.isActive,
    isTimetableAvailable:
      unit.isTimetableAvailable,
  };
}

function mapWorkingDay(
  workingDay: WorkingDay,
): PlanningWorkingDay {
  return {
    id: workingDay.id,
    academicPeriodId:
      workingDay.academicPeriodId,
    dayOfWeek:
      workingDay.dayOfWeek,
    sequenceNumber:
      workingDay.sequenceNumber,
    isEnabled:
      workingDay.isEnabled,
  };
}

function mapTimeSlot(
  timeSlot: TimeSlot,
): PlanningTimeSlot {
  return {
    id: timeSlot.id,
    academicPeriodId:
      timeSlot.academicPeriodId,
    code: timeSlot.code,
    name: timeSlot.name,
    slotType:
      timeSlot.slotType,
    startsAt:
      timeSlot.startsAt,
    endsAt:
      timeSlot.endsAt,
    sequenceNumber:
      timeSlot.sequenceNumber,
    isEnabled:
      timeSlot.isEnabled,
  };
}

function mapExistingSession(
  row: ExistingScheduledSessionRow,
): PlanningSession {
  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,
    teachingAllocationId:
      row.teaching_allocation_id,
    cohortId:
      row.cohort_id,
    unitId:
      row.unit_id,
    trainerId:
      row.trainer_id,
    workingDayId:
      row.working_day_id,
    startTimeSlotId:
      row.start_time_slot_id,
    endTimeSlotId:
      row.end_time_slot_id,
    roomId:
      row.room_id,
    sessionNumber:
      row.session_number,
    deliveryMode:
      row.delivery_mode,
    status:
      row.status,
    source:
      row.source,
    conflictState:
      row.conflict_state,
    isLocked:
      row.is_locked,
  };
}

export function createAutomaticPlannerInput({
  sourceData,
  overwriteExisting = false,
}: {
  sourceData: GeneratorSourceData;
  overwriteExisting?: boolean;
}): AutomaticPlannerInput {
  const existingSessions =
    sourceData.existingSessions
      .filter((session) => {
        if (!overwriteExisting) {
          return true;
        }

        return (
          session.is_locked ||
          session.status === 'locked'
        );
      })
      .map(mapExistingSession);

  return {
    academicPeriodId:
      sourceData.academicPeriod.id,
    allocations:
      sourceData.allocations.map(
        mapAllocation,
      ),
    existingSessions,
    workingDays:
      sourceData.workingDays.map(
        mapWorkingDay,
      ),
    timeSlots:
      sourceData.timeSlots.map(
        mapTimeSlot,
      ),
    trainers:
      sourceData.trainers.map(
        mapTrainer,
      ),
    cohorts:
      sourceData.cohorts.map(
        mapCohort,
      ),
    rooms:
      sourceData.rooms.map(
        mapRoom,
      ),
    units:
      sourceData.units.map(
        mapUnit,
      ),
  };
}

export function createGeneratorReadiness(
  sourceData: GeneratorSourceData,
): GeneratorReadinessSummary {
  const enabledWorkingDays =
    sourceData.workingDays.filter(
      (day) => day.isEnabled,
    );

  const enabledTeachingSlots =
    sourceData.timeSlots.filter(
      (slot) =>
        slot.isEnabled &&
        slot.slotType ===
          'teaching',
    );

  const issues: string[] = [];

  if (
    sourceData.academicPeriod.status ===
    'closed'
  ) {
    issues.push(
      'The selected Academic Period is closed.',
    );
  }

  if (
    sourceData.academicPeriod.status ===
    'archived'
  ) {
    issues.push(
      'The selected Academic Period is archived.',
    );
  }

  if (
    sourceData.allocations.length === 0
  ) {
    issues.push(
      'No timetable-enabled teaching allocations are available.',
    );
  }

  if (
    enabledWorkingDays.length === 0
  ) {
    issues.push(
      'No enabled working days are configured.',
    );
  }

  if (
    enabledTeachingSlots.length === 0
  ) {
    issues.push(
      'No enabled teaching time slots are configured.',
    );
  }

  if (
    sourceData.trainers.length === 0
  ) {
    issues.push(
      'No timetable-available trainers are configured.',
    );
  }

  if (
    sourceData.cohorts.length === 0
  ) {
    issues.push(
      'No timetable-available cohorts are configured.',
    );
  }

  if (
    sourceData.rooms.length === 0
  ) {
    issues.push(
      'No timetable-available rooms are configured.',
    );
  }

  if (
    sourceData.units.length === 0
  ) {
    issues.push(
      'No timetable-available units are configured.',
    );
  }

  return {
    allocationCount:
      sourceData.allocations.length,
    workingDayCount:
      enabledWorkingDays.length,
    teachingSlotCount:
      enabledTeachingSlots.length,
    trainerCount:
      sourceData.trainers.length,
    cohortCount:
      sourceData.cohorts.length,
    roomCount:
      sourceData.rooms.length,
    unitCount:
      sourceData.units.length,
    existingSessionCount:
      sourceData.existingSessions.length,
    isReady:
      issues.length === 0,
    issues,
  };
}

function getConflictTitle(
  conflict: PlanningConflict,
) {
  const titles:
  Record<
    PlanningConflict['type'],
    string
  > = {
    trainer_overlap:
      'Trainer conflict',
    cohort_overlap:
      'Cohort conflict',
    room_overlap:
      'Room conflict',
    duplicate_session:
      'Duplicate session',
    disabled_working_day:
      'Working day unavailable',
    disabled_time_slot:
      'Time slot unavailable',
    non_teaching_time_slot:
      'Non-teaching time slot',
    academic_period_mismatch:
      'Academic Period mismatch',
    invalid_time_range:
      'Invalid session time',
    insufficient_room_capacity:
      'Room capacity conflict',
    incompatible_room_type:
      'Room type conflict',
    trainer_daily_workload:
      'Daily trainer workload',
    trainer_weekly_workload:
      'Weekly trainer workload',
    trainer_unavailable:
      'Trainer unavailable',
    cohort_unavailable:
      'Cohort unavailable',
    room_unavailable:
      'Room unavailable',
    unit_unavailable:
      'Unit unavailable',
  };

  return titles[conflict.type];
}

function mapConflict(
  conflict: PlanningConflict,
): GeneratorConflictSummary {
  return {
    id: conflict.id,
    type: conflict.type,
    severity:
      conflict.severity,
    title:
      getConflictTitle(conflict),
    description:
      conflict.message,
    sessionIds:
      conflict.sessionIds,
    resourceId:
      conflict.resourceId,
    resourceLabel:
      conflict.resourceLabel,
    workingDayId:
      conflict.workingDayId,
    metadata:
      conflict.metadata,
  };
}

function mapPreviewSessions({
  plannerResult,
  sourceData,
}: {
  plannerResult:
    AutomaticPlannerResult;
  sourceData:
    GeneratorSourceData;
}): GeneratorPreviewSession[] {
  const trainers =
    buildLookup(
      sourceData.trainers,
    );

  const cohorts =
    buildLookup(
      sourceData.cohorts,
    );

  const rooms =
    buildLookup(
      sourceData.rooms,
    );

  const units =
    buildLookup(
      sourceData.units,
    );

  const workingDays =
    buildLookup(
      sourceData.workingDays,
    );

  const timeSlots =
    buildLookup(
      sourceData.timeSlots,
    );

  return plannerResult.sessions.map(
    (session) => {
      const trainer =
        trainers.get(
          session.trainerId,
        );

      const cohort =
        cohorts.get(
          session.cohortId,
        );

      const room =
        rooms.get(
          session.roomId,
        );

      const unit =
        units.get(
          session.unitId,
        );

      const workingDay =
        workingDays.get(
          session.workingDayId,
        );

      const startSlot =
        timeSlots.get(
          session.startTimeSlotId,
        );

      const endSlot =
        timeSlots.get(
          session.endTimeSlotId,
        );

      if (
        !trainer ||
        !cohort ||
        !room ||
        !unit ||
        !workingDay ||
        !startSlot ||
        !endSlot
      ) {
        throw new Error(
          `Unable to resolve preview relationships for generated session "${session.id}".`,
        );
      }

      return {
        id: session.id,
        academicPeriodId:
          session.academicPeriodId,
        teachingAllocationId:
          session.teachingAllocationId,
        sessionNumber:
          session.sessionNumber,

        cohortId:
          cohort.id,
        cohortCode:
          cohort.code,
        cohortName:
          cohort.name,

        unitId:
          unit.id,
        unitCode:
          unit.code,
        unitName:
          unit.name,

        trainerId:
          trainer.id,
        trainerStaffNumber:
          trainer.staffNumber,
        trainerName:
          trainer.fullName,

        roomId:
          room.id,
        roomCode:
          room.code,
        roomName:
          room.name,

        workingDayId:
          workingDay.id,
        workingDayName:
          workingDay.dayOfWeek,

        startTimeSlotId:
          startSlot.id,
        startTimeSlotCode:
          startSlot.code,
        startsAt:
          startSlot.startsAt,

        endTimeSlotId:
          endSlot.id,
        endTimeSlotCode:
          endSlot.code,
        endsAt:
          endSlot.endsAt,

        durationMinutes:
          getIntervalDurationMinutes({
            startsAt:
              startSlot.startsAt,
            endsAt:
              endSlot.endsAt,
          }),

        deliveryMode:
          session.deliveryMode,
        status:
          session.status,
        source:
          session.source,
        conflictState:
          session.conflictState,
        isLocked:
          session.isLocked,
      };
    },
  );
}

function mapUnscheduledSessions({
  plannerResult,
  sourceData,
}: {
  plannerResult:
    AutomaticPlannerResult;
  sourceData:
    GeneratorSourceData;
}): GeneratorUnscheduledSession[] {
  const allocations =
    buildLookup(
      sourceData.allocations,
    );

  const trainers =
    buildLookup(
      sourceData.trainers,
    );

  const cohorts =
    buildLookup(
      sourceData.cohorts,
    );

  const units =
    buildLookup(
      sourceData.units,
    );

  return plannerResult.unscheduled.map(
    (unscheduled) => {
      const allocation =
        allocations.get(
          unscheduled
            .teachingAllocationId,
        );

      const trainer =
        allocation
          ? trainers.get(
              allocation.trainerId,
            )
          : undefined;

      const cohort =
        allocation
          ? cohorts.get(
              allocation.cohortId,
            )
          : undefined;

      const unit =
        allocation
          ? units.get(
              allocation.unitId,
            )
          : undefined;

      return {
        teachingAllocationId:
          unscheduled
            .teachingAllocationId,
        sessionNumber:
          unscheduled.sessionNumber,

        cohortCode:
          cohort?.code ?? null,
        cohortName:
          cohort?.name ?? null,

        unitCode:
          unit?.code ?? null,
        unitName:
          unit?.name ?? null,

        trainerStaffNumber:
          trainer?.staffNumber ??
          null,
        trainerName:
          trainer?.fullName ??
          null,

        reason:
          unscheduled.reason,
        message:
          unscheduled.message,
        attemptedCandidateCount:
          unscheduled
            .attemptedCandidateCount,
        conflictTypes:
          unscheduled.conflictTypes,
      };
    },
  );
}

export function createGeneratorPreview({
  sourceData,
  overwriteExisting = false,
  generatedAt =
    new Date().toISOString(),
}: {
  sourceData: GeneratorSourceData;
  overwriteExisting?: boolean;
  generatedAt?: string;
}): GeneratorPreview {
  const readiness =
    createGeneratorReadiness(
      sourceData,
    );

  const plannerInput =
    createAutomaticPlannerInput({
      sourceData,
      overwriteExisting,
    });

  const plannerResult =
    readiness.isReady
      ? generateTimetablePlan(
          plannerInput,
        )
      : {
          sessions: [],
          unscheduled: [],
          conflicts: [],
          suggestions: [],
          statistics: {
            allocationCount:
              sourceData
                .allocations.length,
            requestedSessionCount: 0,
            scheduledSessionCount: 0,
            unscheduledSessionCount: 0,
            conflictCount: 0,
            blockedConflictCount: 0,
            warningCount: 0,
            trainerUtilizationPercentage:
              0,
            roomUtilizationPercentage:
              0,
            generationDurationMilliseconds:
              0,
          },
        };

  return {
    academicPeriod:
      mapAcademicPeriod(
        sourceData.academicPeriod,
      ),

    readiness,

    sessions:
      mapPreviewSessions({
        plannerResult,
        sourceData,
      }),

    unscheduled:
      mapUnscheduledSessions({
        plannerResult,
        sourceData,
      }),

    conflicts:
      plannerResult.conflicts.map(
        mapConflict,
      ),

    statistics:
      plannerResult.statistics,

    generatedAt,
  };
}