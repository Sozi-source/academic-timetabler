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
      'No timetable-enabled units',
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
    issues.push(issue(
      'missing-trainers',
      'blocker',
      `${missingTrainer.length} unit${missingTrainer.length === 1 ? '' : 's'} ${missingTrainer.length === 1 ? 'needs a trainer' : 'need trainers'}`,
      'Assign trainers or include units as unassigned.',
      '/timetable/teaching-allocations',
      'Assign trainers',
    ));
  }

  const reservedWithoutTrainer = enabled.filter(
    (offering) => !offering.trainerId && offering.isProvisionalReservation,
  );
  if (reservedWithoutTrainer.length > 0) {
    issues.push(issue(
      'reserved-trainers-pending',
      'warning',
      `${reservedWithoutTrainer.length} unit${reservedWithoutTrainer.length === 1 ? '' : 's'} ${reservedWithoutTrainer.length === 1 ? 'needs a trainer' : 'need trainers'}`,
      'Assign trainers before publishing.',
      '/timetable/teaching-allocations',
      'Assign trainers',
    ));
  }

  const inactiveTrainer = enabled.filter((offering) => offering.trainerId && (!offering.trainerActive || !offering.trainerTimetableAvailable));
  if (inactiveTrainer.length > 0) {
    issues.push(issue(
      'unavailable-trainers',
      'blocker',
      `${inactiveTrainer.length} unit${inactiveTrainer.length === 1 ? '' : 's'} ${inactiveTrainer.length === 1 ? 'uses an unavailable trainer' : 'use unavailable trainers'}`,
      'Replace unavailable trainers.',
      '/timetable/trainers',
      'Review trainers',
    ));
  }

  const missingParticipants = enabled.filter((offering) => offering.participants.length === 0);
  if (missingParticipants.length > 0) {
    issues.push(issue(
      'missing-participants',
      'blocker',
      `${missingParticipants.length} unit${missingParticipants.length === 1 ? '' : 's'} ${missingParticipants.length === 1 ? 'needs participants' : 'need participants'}`,
      'Add at least one cohort to each unit.',
    ));
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
    issues.push(issue(
      'no-preferred-room',
      'info',
      `${noPreferredRoom.length} unit${noPreferredRoom.length === 1 ? '' : 's'} ${noPreferredRoom.length === 1 ? 'needs a room' : 'need rooms'}`,
      'Rooms are optional and can remain pending.',
    ));
  }

  const draft = enabled.filter((offering) => offering.status === 'draft');
  if (draft.length > 0) {
    issues.push(issue(
      'draft-offerings',
      'warning',
      `${draft.length} unit${draft.length === 1 ? '' : 's'} ${draft.length === 1 ? 'is' : 'are'} in draft`,
      'Activate confirmed units before generating.',
    ));
  }

  const workloads = calculateTrainerWorkloads(enabled);
  const overloaded = workloads.filter((workload) => workload.overloaded);
  if (overloaded.length > 0) {
    issues.push(issue(
      'trainer-overload',
      'warning',
      `${overloaded.length} trainer${overloaded.length === 1 ? '' : 's'} ${overloaded.length === 1 ? 'exceeds' : 'exceed'} target hours`,
      'Review extra hours before publishing.',
      '/timetable/reports?report=workload',
      'Review hours',
    ));
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
