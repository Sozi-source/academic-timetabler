import type {
  ReadinessIssue,
  ReadinessOffering,
  TrainerReadinessWorkload,
} from './types';

export interface AssessReadinessInput {
  academicPeriodStatus: string;
  offerings: ReadinessOffering[];
  workingDayCount: number;
  teachingSlotCount: number;
  availableTrainerCount: number;
  availableRoomCount: number;
}

function issue(
  id: string,
  severity: ReadinessIssue['severity'],
  title: string,
  description: string,
  actionHref?: string,
  actionLabel?: string,
): ReadinessIssue {
  return {
    id,
    severity,
    title,
    description,
    actionHref,
    actionLabel,
  };
}

export function calculateTrainerWorkloads(
  offerings: ReadinessOffering[],
): TrainerReadinessWorkload[] {
  const workloads = new Map<string, TrainerReadinessWorkload>();

  for (const offering of offerings) {
    if (!offering.isTimetableEnabled || !offering.trainerId || !offering.trainerName) {
      continue;
    }

    const hours = offering.weeklySessions * offering.sessionDurationMinutes / 60;
    const maximum = offering.trainerMaximumWeeklyHours ?? 0;
    const existing = workloads.get(offering.trainerId) ?? {
      trainerId: offering.trainerId,
      trainerName: offering.trainerName,
      staffNumber: offering.trainerStaffNumber ?? '—',
      maximumWeeklyHours: maximum,
      allocatedWeeklyHours: 0,
      remainingWeeklyHours: maximum,
      extraWeeklyHours: 0,
      utilizationPercentage: 0,
      overloaded: false,
    };

    existing.allocatedWeeklyHours += hours;
    existing.remainingWeeklyHours = Math.max(0, maximum - existing.allocatedWeeklyHours);
    existing.extraWeeklyHours = Math.max(0, existing.allocatedWeeklyHours - maximum);
    existing.utilizationPercentage = maximum > 0
      ? Number((existing.allocatedWeeklyHours / maximum * 100).toFixed(1))
      : 0;
    existing.overloaded = maximum > 0 && existing.allocatedWeeklyHours > maximum;
    workloads.set(offering.trainerId, existing);
  }

  return Array.from(workloads.values()).sort((a, b) =>
    b.utilizationPercentage - a.utilizationPercentage ||
    a.trainerName.localeCompare(b.trainerName),
  );
}

export function assessSchedulingReadiness(input: AssessReadinessInput) {
  const issues: ReadinessIssue[] = [];
  const enabled = input.offerings.filter((offering) => offering.isTimetableEnabled);

  if (!['planned', 'active'].includes(input.academicPeriodStatus)) {
    issues.push(issue(
      'period-not-open',
      'blocker',
      'Academic Period is not open',
      'Timetable preparation is allowed only for planned or active Academic Periods.',
      '/timetable/academic-periods',
      'Review Academic Period',
    ));
  }

  if (enabled.length === 0) {
    issues.push(issue(
      'no-offerings',
      'blocker',
      'No timetable-enabled teaching offerings',
      'Import or enable Units on Offer before preparing allocations.',
      '/timetable/unit-offerings',
      'Open Units on Offer',
    ));
  }

  if (input.workingDayCount === 0) {
    issues.push(issue('no-days', 'blocker', 'No enabled working days', 'Configure working days for the selected Academic Period.', '/timetable/time-slots', 'Configure calendar'));
  }

  if (input.teachingSlotCount === 0) {
    issues.push(issue('no-slots', 'blocker', 'No enabled teaching slots', 'Create at least one enabled teaching time slot.', '/timetable/time-slots', 'Configure time slots'));
  }

  if (
    input.availableTrainerCount === 0 &&
    enabled.some((offering) => Boolean(offering.trainerId))
  ) {
    issues.push(issue('no-trainers', 'blocker', 'No timetable-available trainers', 'Activate at least one trainer for timetable allocation.', '/timetable/trainers', 'Manage trainers'));
  }

  const missingTrainer = enabled.filter(
    (offering) => !offering.trainerId && !offering.isProvisionalReservation,
  );
  if (missingTrainer.length > 0) {
    issues.push(issue('missing-trainers', 'blocker', `${missingTrainer.length} offering${missingTrainer.length === 1 ? '' : 's'} without a trainer`, 'Assign trainers, or include these units as unassigned so draft generation can continue.', '/timetable/teaching-allocations', 'Review allocations'));
  }

  const reservedWithoutTrainer = enabled.filter(
    (offering) => !offering.trainerId && offering.isProvisionalReservation,
  );
  if (reservedWithoutTrainer.length > 0) {
    issues.push(issue(
      'reserved-trainers-pending',
      'warning',
      `${reservedWithoutTrainer.length} included offering${reservedWithoutTrainer.length === 1 ? '' : 's'} with an unassigned trainer`,
      'These sessions can be generated and saved as a draft. Assign trainers before publication.',
      '/timetable/teaching-allocations',
      'Assign trainers',
    ));
  }

  const inactiveTrainer = enabled.filter((offering) => offering.trainerId && (!offering.trainerActive || !offering.trainerTimetableAvailable));
  if (inactiveTrainer.length > 0) {
    issues.push(issue('unavailable-trainers', 'blocker', `${inactiveTrainer.length} offering${inactiveTrainer.length === 1 ? '' : 's'} use unavailable trainers`, 'Replace inactive or timetable-disabled trainers.', '/timetable/trainers', 'Review trainers'));
  }

  const missingParticipants = enabled.filter((offering) => offering.participants.length === 0);
  if (missingParticipants.length > 0) {
    issues.push(issue('missing-participants', 'blocker', `${missingParticipants.length} offering${missingParticipants.length === 1 ? '' : 's'} without cohort participants`, 'Every teaching offering must contain at least one cohort and unit participant.'));
  }

  const unavailableParticipants = enabled.flatMap((offering) => offering.participants).filter((participant) =>
    !participant.cohortTimetableAvailable ||
    !['active', 'planned'].includes(participant.cohortStatus) ||
    !participant.unitActive ||
    !participant.unitTimetableAvailable,
  );
  if (unavailableParticipants.length > 0) {
    issues.push(issue('unavailable-participants', 'blocker', `${unavailableParticipants.length} participant record${unavailableParticipants.length === 1 ? '' : 's'} are unavailable`, 'Review cohort and Master Unit lifecycle settings.', '/timetable/cohorts', 'Review cohorts'));
  }

  const undersizedRooms = enabled.filter((offering) => {
    if (!offering.preferredRoomId || offering.preferredRoomCapacity === null) return false;
    const required = offering.participants.reduce((total, participant) => total + participant.cohortSize, 0);
    return offering.preferredRoomCapacity < required;
  });
  if (undersizedRooms.length > 0) {
    issues.push(issue('undersized-rooms', 'blocker', `${undersizedRooms.length} preferred room assignment${undersizedRooms.length === 1 ? '' : 's'} lack capacity`, 'Choose rooms that can accommodate all participating cohorts.', '/timetable/rooms', 'Review rooms'));
  }

  const unavailableRooms = enabled.filter((offering) => offering.preferredRoomId && (!offering.preferredRoomActive || !offering.preferredRoomTimetableAvailable));
  if (unavailableRooms.length > 0) {
    issues.push(issue('unavailable-rooms', 'blocker', `${unavailableRooms.length} preferred room assignment${unavailableRooms.length === 1 ? '' : 's'} are unavailable`, 'Replace inactive or timetable-disabled rooms.', '/timetable/rooms', 'Review rooms'));
  }

  const noPreferredRoom = enabled.filter((offering) => !offering.preferredRoomId);
  if (noPreferredRoom.length > 0) {
    issues.push(issue('no-preferred-room', 'info', `${noPreferredRoom.length} offering${noPreferredRoom.length === 1 ? ' has' : 's have'} no room assigned`, 'Room assignment is optional. These sessions can be generated and saved with the room marked as pending.'));
  }

  const draft = enabled.filter((offering) => offering.status === 'draft');
  if (draft.length > 0) {
    issues.push(issue('draft-offerings', 'warning', `${draft.length} offering${draft.length === 1 ? '' : 's'} remain in draft`, 'Review and activate confirmed teaching requirements before final generation.'));
  }

  const workloads = calculateTrainerWorkloads(enabled);
  const overloaded = workloads.filter((workload) => workload.overloaded);
  if (overloaded.length > 0) {
    issues.push(issue('trainer-overload', 'warning', `${overloaded.length} trainer${overloaded.length === 1 ? '' : 's'} have extra weekly hours`, 'Allocation may continue. Review and confirm the extra hours shown on each trainer timetable.', '/timetable/reports?report=workload', 'Review extra hours'));
  }

  const blockerCount = issues.filter((entry) => entry.severity === 'blocker').length;
  const warningCount = issues.filter((entry) => entry.severity === 'warning').length;
  const denominator = Math.max(enabled.length * 5 + 4, 1);
  const penalties = blockerCount * 8 + warningCount * 2;
  const score = Math.max(0, Math.min(100, Math.round((denominator - penalties) / denominator * 100)));

  return {
    issues,
    workloads,
    blockerCount,
    warningCount,
    score,
    isReady: blockerCount === 0 && enabled.length > 0,
  };
}
