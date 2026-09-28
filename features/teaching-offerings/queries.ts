import 'server-only';

import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TeachingOfferingCohortSummary,
  TeachingOfferingDetail,
  TeachingOfferingParticipantDetail,
  TeachingOfferingProgrammeSummary,
  TeachingOfferingUnitSummary,
} from './types';
import type {
  OfferingCohortRelation,
  OfferingProgrammeRelation,
  OfferingRoomRelation,
  OfferingTrainerRelation,
  OfferingUnitRelation,
  TeachingOfferingParticipantQueryRow,
  TeachingOfferingQueryRow,
} from './query-types';

const teachingOfferingSelection = `
  id,
  academic_period_id,
  title,
  normalized_title,
  trainer_id,
  preferred_room_id,
  delivery_mode,
  weekly_sessions,
  session_duration_minutes,
  status,
  is_timetable_enabled,
  legacy_teaching_allocation_id,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at,

  academic_periods (
    id,
    code,
    name,
    status,
    starts_on,
    ends_on
  ),

  trainers (
    id,
    staff_number,
    full_name,
    maximum_weekly_hours,
    maximum_daily_hours,
    is_active,
    is_timetable_available
  ),

  rooms (
    id,
    code,
    name,
    room_type,
    capacity,
    is_active,
    is_timetable_available
  ),

  teaching_offering_participants (
    id,
    teaching_offering_id,
    cohort_id,
    unit_id,
    is_primary,
    notes,
    created_by,
    updated_by,
    created_at,
    updated_at,

    cohorts (
      id,
      programme_id,
      code,
      name,
      intake_date,
      current_academic_period_number,
      planned_size,
      actual_size,
      status,
      is_timetable_available,

      programmes (
        id,
        code,
        name,
        short_name,
        award_level,
        total_academic_periods,
        is_active,
        is_timetable_available
      )
    ),

    units (
      id,
      programme_id,
      code,
      name,
      short_name,
      academic_period_number,
      preferred_room_type,
      is_active,
      is_timetable_available,

      programmes (
        id,
        code,
        name,
        short_name,
        award_level,
        total_academic_periods,
        is_active,
        is_timetable_available
      )
    )
  )
`;

function getRelation<T>(
  value:
    | T
    | T[]
    | null,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapProgramme(
  relation:
    | OfferingProgrammeRelation
    | OfferingProgrammeRelation[]
    | null,
): TeachingOfferingProgrammeSummary | null {
  const programme =
    getRelation(relation);

  if (!programme) {
    return null;
  }

  return {
    id: programme.id,
    code: programme.code,
    name: programme.name,
    shortName:
      programme.short_name,
    awardLevel:
      programme.award_level,
  };
}

function mapCohort(
  relation:
    | OfferingCohortRelation
    | OfferingCohortRelation[]
    | null,
): TeachingOfferingCohortSummary | null {
  const cohort =
    getRelation(relation);

  if (!cohort) {
    return null;
  }

  return {
    id: cohort.id,
    programmeId:
      cohort.programme_id,
    code: cohort.code,
    name: cohort.name,
    intakeDate:
      cohort.intake_date,
    currentAcademicPeriodNumber:
      cohort.current_academic_period_number,
    plannedSize:
      cohort.planned_size,
    actualSize:
      cohort.actual_size,
    programme:
      mapProgramme(
        cohort.programmes,
      ),
  };
}

function mapUnit(
  relation:
    | OfferingUnitRelation
    | OfferingUnitRelation[]
    | null,
): TeachingOfferingUnitSummary | null {
  const unit =
    getRelation(relation);

  if (!unit) {
    return null;
  }

  return {
    id: unit.id,
    programmeId:
      unit.programme_id,
    code: unit.code,
    name: unit.name,
    shortName:
      unit.short_name,
    academicPeriodNumber:
      unit.academic_period_number,
    preferredRoomType:
      unit.preferred_room_type,
    programme:
      mapProgramme(
        unit.programmes,
      ),
  };
}

function mapParticipant(
  row:
    TeachingOfferingParticipantQueryRow,
): TeachingOfferingParticipantDetail {
  return {
    id: row.id,
    teachingOfferingId:
      row.teaching_offering_id,
    cohortId:
      row.cohort_id,
    unitId:
      row.unit_id,
    isPrimary:
      row.is_primary,
    notes:
      row.notes,
    createdBy:
      row.created_by,
    updatedBy:
      row.updated_by,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
    cohort:
      mapCohort(row.cohorts),
    unit:
      mapUnit(row.units),
  };
}

function mapTrainer(
  relation:
    | OfferingTrainerRelation
    | OfferingTrainerRelation[]
    | null,
) {
  return getRelation(relation);
}

function mapRoom(
  relation:
    | OfferingRoomRelation
    | OfferingRoomRelation[]
    | null,
) {
  return getRelation(relation);
}

function uniqueSorted(
  values: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      values.filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      ),
    ),
  ).sort((first, second) =>
    first.localeCompare(second),
  );
}

function mapTeachingOffering(
  row:
    TeachingOfferingQueryRow,
): TeachingOfferingDetail {
  const participants =
    (
      row.teaching_offering_participants ??
      []
    )
      .map(mapParticipant)
      .sort(
        (first, second) =>
          Number(second.isPrimary) -
            Number(first.isPrimary) ||
          (
            first.cohort?.programme
              ?.name ?? ''
          ).localeCompare(
            second.cohort?.programme
              ?.name ?? '',
          ) ||
          (
            first.cohort?.name ?? ''
          ).localeCompare(
            second.cohort?.name ?? '',
          ),
      );

  const trainer =
    mapTrainer(row.trainers);

  const room =
    mapRoom(row.rooms);

  const uniqueCohortSizes =
    new Map<string, number>();

  for (const participant of participants) {
    if (!participant.cohort) {
      continue;
    }

    uniqueCohortSizes.set(
      participant.cohort.id,
      Math.max(
        0,
        participant.cohort.actualSize,
      ),
    );
  }

  const combinedCohortSize =
    Array.from(
      uniqueCohortSizes.values(),
    ).reduce(
      (total, size) =>
        total + size,
      0,
    );

  return {
    id: row.id,
    academicPeriodId:
      row.academic_period_id,

    title: row.title,
    normalizedTitle:
      row.normalized_title,

    trainerId:
      row.trainer_id,
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

    participants,

    participantCount:
      participants.length,

    combinedCohortSize,

    isShared:
      uniqueCohortSizes.size > 1,

    programmeNames:
      uniqueSorted(
        participants.map(
          (participant) =>
            participant.cohort
              ?.programme?.name,
        ),
      ),

    cohortNames:
      uniqueSorted(
        participants.map(
          (participant) =>
            participant.cohort?.name,
        ),
      ),

    unitNames:
      uniqueSorted(
        participants.map(
          (participant) =>
            participant.unit?.name,
        ),
      ),

    unitCodes:
      uniqueSorted(
        participants.map(
          (participant) =>
            participant.unit?.code,
        ),
      ),

    trainerName:
      trainer?.full_name ?? null,

    trainerStaffNumber:
      trainer?.staff_number ?? null,

    preferredRoomName:
      room?.name ?? null,

    preferredRoomCode:
      room?.code ?? null,
  };
}

export const getTeachingOfferings =
  cache(
    async (): Promise<
      TeachingOfferingDetail[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('teaching_offerings')
        .select(
          teachingOfferingSelection,
        )
        .order(
          'academic_period_id',
          {
            ascending: false,
          },
        )
        .order('title', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load teaching offerings: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as TeachingOfferingQueryRow[]
      ).map(mapTeachingOffering);
    },
  );

export const getTeachingOfferingsByPeriod =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      TeachingOfferingDetail[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('teaching_offerings')
        .select(
          teachingOfferingSelection,
        )
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .order('title', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load Teaching Offerings for the Academic Period: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as TeachingOfferingQueryRow[]
      ).map(mapTeachingOffering);
    },
  );

export const getTeachingOfferingById =
  cache(
    async (
      id: string,
    ): Promise<
      TeachingOfferingDetail | null
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('teaching_offerings')
        .select(
          teachingOfferingSelection,
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Unable to load the Teaching Offering: ${error.message}`,
        );
      }

      return data
        ? mapTeachingOffering(
            data as TeachingOfferingQueryRow,
          )
        : null;
    },
  );

export const getTimetableEnabledTeachingOfferings =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      TeachingOfferingDetail[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('teaching_offerings')
        .select(
          teachingOfferingSelection,
        )
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .eq(
          'is_timetable_enabled',
          true,
        )
        .in('status', [
          'active',
          'draft',
        ])
        .order('title', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load timetable-enabled Teaching Offerings: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as TeachingOfferingQueryRow[]
      ).map(mapTeachingOffering);
    },
  );