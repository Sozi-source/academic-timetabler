import type {
  TeachingOffering,
  TeachingOfferingParticipant,
  TeachingOfferingParticipantRow,
  TeachingOfferingRow,
} from './types';

export function mapTeachingOfferingRow(
  row: TeachingOfferingRow,
): TeachingOffering {
  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,

    title: row.title,
    normalizedTitle:
      row.normalized_title,

    trainerId: row.trainer_id,
    preferredRoomId:
      row.preferred_room_id,

    deliveryMode:
      row.delivery_mode,
    weeklySessions:
      row.weekly_sessions,
    sessionDurationMinutes:
      row.session_duration_minutes,

    status: row.status,
    isTimetableEnabled:
      row.is_timetable_enabled,

    legacyTeachingAllocationId:
      row.legacy_teaching_allocation_id,

    notes: row.notes,

    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTeachingOfferingParticipantRow(
  row: TeachingOfferingParticipantRow,
): TeachingOfferingParticipant {
  return {
    id: row.id,

    teachingOfferingId:
      row.teaching_offering_id,

    cohortId: row.cohort_id,
    unitId: row.unit_id,

    isPrimary: row.is_primary,
    notes: row.notes,

    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}