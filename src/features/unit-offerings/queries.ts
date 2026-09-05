import 'server-only';

import {
  cache,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  UnitOffering,
  UnitOfferingAcademicPeriodSummary,
  UnitOfferingCohortSummary,
  UnitOfferingProgrammeSummary,
  UnitOfferingUnitSummary,
} from './types';

import type {
  UnitOfferingAcademicPeriodRelation,
  UnitOfferingCohortRelation,
  UnitOfferingProgrammeRelation,
  UnitOfferingQueryRow,
  UnitOfferingUnitRelation,
} from './query-types';

const unitOfferingSelection = `
  id,
  academic_period_id,
  cohort_id,
  unit_id,
  offering_type,
  status,
  is_timetable_enabled,
  weekly_sessions,
  session_duration_minutes,
  delivery_notes,
  source,
  origin,
  selection_state,
  approval_status,
  approved_by,
  approved_at,
  withdrawn_by,
  withdrawn_at,
  withdrawal_reason,
  recommended_stage_number,
  exception_reason,
  manually_reviewed,
  reviewed_by,
  reviewed_at,
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

  cohorts (
    id,
    programme_id,
    code,
    name,
    intake_date,
    expected_completion_date,
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
      total_academic_periods
    )
  ),

  units (
    id,
    programme_id,
    code,
    name,
    short_name,
    category,
    academic_period_number,
    theory_hours,
    practical_hours,
    weekly_sessions,
    preferred_room_type,
    is_active,
    is_timetable_available,

    programmes (
      id,
      code,
      name,
      short_name,
      award_level,
      total_academic_periods
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
    | UnitOfferingProgrammeRelation
    | UnitOfferingProgrammeRelation[]
    | null,
): UnitOfferingProgrammeSummary | null {
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
    totalAcademicPeriods:
      programme.total_academic_periods,
  };
}

function mapAcademicPeriod(
  relation:
    | UnitOfferingAcademicPeriodRelation
    | UnitOfferingAcademicPeriodRelation[]
    | null,
): UnitOfferingAcademicPeriodSummary | null {
  const period =
    getRelation(relation);

  if (!period) {
    return null;
  }

  return {
    id: period.id,
    code: period.code,
    name: period.name,
    status: period.status,
    startsOn: period.starts_on,
    endsOn: period.ends_on,
  };
}

function mapCohort(
  relation:
    | UnitOfferingCohortRelation
    | UnitOfferingCohortRelation[]
    | null,
): UnitOfferingCohortSummary | null {
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
    expectedCompletionDate:
      cohort.expected_completion_date,
    currentAcademicPeriodNumber:
      cohort.current_academic_period_number,
    plannedSize:
      cohort.planned_size,
    actualSize:
      cohort.actual_size,
    status: cohort.status,
    isTimetableAvailable:
      cohort.is_timetable_available,
    programme:
      mapProgramme(
        cohort.programmes,
      ),
  };
}

function mapUnit(
  relation:
    | UnitOfferingUnitRelation
    | UnitOfferingUnitRelation[]
    | null,
): UnitOfferingUnitSummary | null {
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
    category: unit.category,
    academicPeriodNumber:
      unit.academic_period_number,
    theoryHours:
      Number(unit.theory_hours),
    practicalHours:
      Number(unit.practical_hours),
    weeklySessions:
      unit.weekly_sessions,
    preferredRoomType:
      unit.preferred_room_type,
    isActive:
      unit.is_active,
    isTimetableAvailable:
      unit.is_timetable_available,
    programme:
      mapProgramme(
        unit.programmes,
      ),
  };
}

function mapUnitOffering(
  row: UnitOfferingQueryRow,
): UnitOffering {
  return {
    id: row.id,

    academicPeriodId:
      row.academic_period_id,
    cohortId:
      row.cohort_id,
    unitId:
      row.unit_id,

    offeringType:
      row.offering_type,
    status: row.status,
    isTimetableEnabled:
      row.is_timetable_enabled,

    weeklySessions:
      row.weekly_sessions,
    sessionDurationMinutes:
      row.session_duration_minutes,

    deliveryNotes:
      row.delivery_notes,
    source: row.source,

    origin: row.origin,
    selectionState:
      row.selection_state,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    withdrawnBy: row.withdrawn_by,
    withdrawnAt: row.withdrawn_at,
    withdrawalReason: row.withdrawal_reason,

    recommendedStageNumber:
      row.recommended_stage_number,

    exceptionReason:
      row.exception_reason,

    manuallyReviewed:
      row.manually_reviewed,
    reviewedBy:
      row.reviewed_by,
    reviewedAt:
      row.reviewed_at,

    createdBy:
      row.created_by,
    updatedBy:
      row.updated_by,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,

    academicPeriod:
      mapAcademicPeriod(
        row.academic_periods,
      ),

    cohort:
      mapCohort(row.cohorts),

    unit:
      mapUnit(row.units),
  };
}

export const getUnitOfferings =
  cache(
    async (): Promise<
      UnitOffering[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('unit_offerings')
        .select(
          unitOfferingSelection,
        )
        .order(
          'academic_period_id',
          {
            ascending: false,
          },
        )
        .order('cohort_id', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load Units on Offer: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as UnitOfferingQueryRow[]
      ).map(mapUnitOffering);
    },
  );

export const getUnitOfferingsByPeriod =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      UnitOffering[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('unit_offerings')
        .select(
          unitOfferingSelection,
        )
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .order('cohort_id', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load Units on Offer for the Academic Period: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as UnitOfferingQueryRow[]
      ).map(mapUnitOffering);
    },
  );

export const getUnitOfferingsByCohort =
  cache(
    async (
      academicPeriodId: string,
      cohortId: string,
    ): Promise<
      UnitOffering[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('unit_offerings')
        .select(
          unitOfferingSelection,
        )
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .eq(
          'cohort_id',
          cohortId,
        )
        .order(
          'selection_state',
          {
            ascending: false,
          },
        )
        .order('unit_id', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load the cohort Units on Offer: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as UnitOfferingQueryRow[]
      ).map(mapUnitOffering);
    },
  );

export const getUnitOfferingById =
  cache(
    async (
      id: string,
    ): Promise<
      UnitOffering | null
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('unit_offerings')
        .select(
          unitOfferingSelection,
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Unable to load the Unit on Offer: ${error.message}`,
        );
      }

      return data
        ? mapUnitOffering(
            data as UnitOfferingQueryRow,
          )
        : null;
    },
  );

export const getSchedulableUnitOfferings =
  cache(
    async (
      academicPeriodId: string,
    ): Promise<
      UnitOffering[]
    > => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('unit_offerings')
        .select(
          unitOfferingSelection,
        )
        .eq(
          'academic_period_id',
          academicPeriodId,
        )
        .eq(
          'selection_state',
          'included',
        )
        .eq('approval_status', 'approved')
        .eq(
          'is_timetable_enabled',
          true,
        )
        .in('status', [
          'draft',
          'active',
        ])
        .in('offering_type', [
          'classroom',
          'practical',
          'project',
          'other',
        ])
        .order('cohort_id', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load schedulable Units on Offer: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as UnitOfferingQueryRow[]
      ).map(mapUnitOffering);
    },
  );

export const getSpecialUnitCandidates =
  cache(
    async (
      programmeId: string,
      currentStageNumber: number,
    ) => {
      const supabase =
        await createClient();

      const {
        data,
        error,
      } = await supabase
        .from('units')
        .select(`
          id,
          programme_id,
          code,
          name,
          short_name,
          category,
          academic_period_number,
          theory_hours,
          practical_hours,
          weekly_sessions,
          preferred_room_type,
          is_active,
          is_timetable_available,

          programmes (
            id,
            code,
            name,
            short_name,
            award_level,
            total_academic_periods
          )
        `)
        .eq(
          'programme_id',
          programmeId,
        )
        .eq('is_active', true)
        .neq(
          'academic_period_number',
          currentStageNumber,
        )
        .order(
          'academic_period_number',
          {
            ascending: true,
          },
        )
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load special-unit candidates: ${error.message}`,
        );
      }

      return (
        (
          data ?? []
        ) as UnitOfferingUnitRelation[]
      ).map((unit) =>
        mapUnit(unit),
      ).filter(
        (
          unit,
        ): unit is UnitOfferingUnitSummary =>
          unit !== null,
      );
    },
  );

export const getCohortUnitEditorOptions = cache(async () => {
  const supabase = await createClient();
  const [cohortResult, unitResult] = await Promise.all([
    supabase.from('cohorts').select(`
      id, code, name, programme_id, current_academic_period_number,
      programmes!inner(id, name)
    `).in('status', ['planned', 'active']).eq('is_timetable_available', true).order('name'),
    supabase.from('units').select(`
      id, code, name, programme_id, academic_period_number,
      programmes(id, name, code)
    `).neq('is_active', false).order('name'),
  ]);
  if (cohortResult.error) throw new Error(`Unable to load cohort editor options: ${cohortResult.error.message}`);
  if (unitResult.error) throw new Error(`Unable to load programme units: ${unitResult.error.message}`);
  return {
    cohorts: (cohortResult.data ?? []).map((row) => {
      const programme = Array.isArray(row.programmes) ? row.programmes[0] : row.programmes;
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        programmeId: row.programme_id,
        programmeName: programme?.name ?? 'Programme',
        currentStage: row.current_academic_period_number,
      };
    }),
    units: (unitResult.data ?? []).map((row) => {
      const programme = Array.isArray(row.programmes) ? row.programmes[0] : row.programmes;
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        programmeId: row.programme_id,
        programmeName: programme?.name ?? null,
        stage: row.academic_period_number ?? null,
      };
    }),
  };
});
