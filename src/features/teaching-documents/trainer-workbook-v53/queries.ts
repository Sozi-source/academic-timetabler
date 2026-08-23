import {
  createClient,
} from '@/lib/supabase/server';
import {
  TRAINER_ALLOCATION_OWNER_COLUMN,
  TRAINER_ALLOCATION_TABLE,
  TRAINER_TABLE,
} from './config';
import type {
  TrainerAllocationDocumentRowV53,
  TrainerDocumentSummaryV53,
  TrainerTeachingDocumentType,
} from './types';

async function currentUser() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser();

  if (
    error ||
    !user
  ) {
    throw new Error(
      'You must be signed in.',
    );
  }

  return {
    supabase,
    user,
  };
}

async function resolveCurrentTrainerIdV53(
  supabase: any,
  user: {
    id: string;
    email?:
      | string
      | null;
  },
) {
  const userIdColumns = [
    'user_id',
    'profile_id',
    'auth_user_id',
  ] as const;

  for (
    const column of
    userIdColumns
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        TRAINER_TABLE,
      )
      .select('id')
      .eq(
        column,
        user.id,
      )
      .limit(2);

    if (
      !error &&
      Array.isArray(
        data,
      ) &&
      data.length ===
        1 &&
      data[0]?.id
    ) {
      return String(
        data[0].id,
      );
    }
  }

  if (user.email) {
    const {
      data,
      error,
    } = await supabase
      .from(
        TRAINER_TABLE,
      )
      .select('id')
      .eq(
        'email',
        user.email,
      )
      .limit(2);

    if (
      !error &&
      Array.isArray(
        data,
      ) &&
      data.length ===
        1 &&
      data[0]?.id
    ) {
      return String(
        data[0].id,
      );
    }
  }

  return null;
}

export async function loadAccessibleTrainerAllocationsV53() {
  const {
    supabase,
    user,
  } =
    await currentUser();

  const trainerId =
    await resolveCurrentTrainerIdV53(
      supabase as any,
      user,
    );

  if (!trainerId) {
    return [] as TrainerAllocationDocumentRowV53[];
  }

  const {
    data: allocations,
    error,
  } = await (supabase as any)
    .from(
      TRAINER_ALLOCATION_TABLE,
    )
    .select(
      `id,unit_id,${TRAINER_ALLOCATION_OWNER_COLUMN}`,
    )
    .eq(
      TRAINER_ALLOCATION_OWNER_COLUMN,
      trainerId,
    )
    .not(
      'unit_id',
      'is',
      null,
    );

  if (error) {
    throw new Error(
      `Your teaching allocations could not be loaded: ${error.message}`,
    );
  }

  const cleanAllocations =
    (allocations ?? [])
      .filter(
        (row: any) =>
          row?.id &&
          row?.unit_id &&
          String(
            row[
              TRAINER_ALLOCATION_OWNER_COLUMN
            ] ?? '',
          ) ===
            trainerId,
      )
      .map(
        (row: any) => ({
          allocationId:
            String(
              row.id,
            ),
          unitId:
            String(
              row.unit_id,
            ),
        }),
      );

  const unitIds = [
    ...new Set(
      cleanAllocations.map(
        (row: {
          unitId: string;
        }) =>
          row.unitId,
      ),
    ),
  ];

  if (
    !unitIds.length
  ) {
    return [] as TrainerAllocationDocumentRowV53[];
  }

  const {
    data: units,
    error:
      unitsError,
  } = await (supabase as any)
    .from('units')
    .select(
      'id,code,name',
    )
    .in(
      'id',
      unitIds,
    );

  if (unitsError) {
    throw new Error(
      `Your allocated units could not be loaded: ${unitsError.message}`,
    );
  }

  const unitMap =
    new Map<
      string,
      {
        unitCode:
          string;
        unitName:
          string;
      }
    >(
      (units ?? []).map(
        (unit: any) => [
          String(
            unit.id,
          ),
          {
            unitCode:
              String(
                unit.code ??
                  '',
              ),
            unitName:
              String(
                unit.name ??
                  '',
              ),
          },
        ],
      ),
    );

  return cleanAllocations
    .map(
      (allocation: {
        allocationId:
          string;
        unitId: string;
      }) => {
        const unit =
          unitMap.get(
            allocation.unitId,
          );

        if (!unit) {
          return null;
        }

        return {
          allocationId:
            allocation.allocationId,
          unitId:
            allocation.unitId,
          unitCode:
            unit.unitCode,
          unitName:
            unit.unitName,
        };
      },
    )
    .filter(
      Boolean,
    ) as TrainerAllocationDocumentRowV53[];
}

async function activeInstitutionalUnitIds(
  supabase: any,
  unitIds: string[],
  documentType:
    TrainerTeachingDocumentType,
) {
  if (
    !unitIds.length
  ) {
    return new Set<string>();
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'curriculum_document_versions',
    )
    .select(
      'unit_id',
    )
    .in(
      'unit_id',
      unitIds,
    )
    .eq(
      'document_type',
      documentType,
    )
    .eq(
      'status',
      'active',
    );

  if (error) {
    throw new Error(
      `Institutional curriculum documents could not be loaded: ${error.message}`,
    );
  }

  return new Set(
    (data ?? []).map(
      (row: any) =>
        String(
          row.unit_id,
        ),
    ),
  );
}

async function activeTrainerAllocationIds(
  supabase: any,
  allocationIds: string[],
  documentType:
    TrainerTeachingDocumentType,
) {
  if (
    !allocationIds.length
  ) {
    return new Set<string>();
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'trainer_teaching_document_versions',
    )
    .select(
      'allocation_id',
    )
    .in(
      'allocation_id',
      allocationIds,
    )
    .eq(
      'document_type',
      documentType,
    )
    .eq(
      'status',
      'active',
    );

  if (error) {
    throw new Error(
      `Trainer teaching documents could not be loaded: ${error.message}`,
    );
  }

  return new Set(
    (data ?? []).map(
      (row: any) =>
        String(
          row.allocation_id,
        ),
    ),
  );
}

export async function loadMissingTrainerDocumentsV53(
  documentType:
    TrainerTeachingDocumentType,
) {
  const {
    supabase,
  } =
    await currentUser();

  const allocations =
    await loadAccessibleTrainerAllocationsV53();

  if (
    !allocations.length
  ) {
    return [] as TrainerAllocationDocumentRowV53[];
  }

  const [
    institutionalUnits,
    trainerAllocations,
  ] =
    await Promise.all([
      activeInstitutionalUnitIds(
        supabase as any,
        [
          ...new Set(
            allocations.map(
              (item) =>
                item.unitId,
            ),
          ),
        ],
        documentType,
      ),
      activeTrainerAllocationIds(
        supabase as any,
        allocations.map(
          (item) =>
            item.allocationId,
        ),
        documentType,
      ),
    ]);

  return allocations.filter(
    (item) =>
      !institutionalUnits.has(
        item.unitId,
      ) &&
      !trainerAllocations.has(
        item.allocationId,
      ),
  );
}

export async function loadTrainerDocumentSummaryV53(): Promise<TrainerDocumentSummaryV53> {
  const {
    supabase,
  } =
    await currentUser();

  const allocations =
    await loadAccessibleTrainerAllocationsV53();

  if (
    !allocations.length
  ) {
    return {
      totalAllocations:
        0,
      activeCourseOutlines:
        0,
      activeSchemes: 0,
      missingCourseOutlines:
        [],
      missingSchemes: [],
    };
  }

  const uniqueUnitIds = [
    ...new Set(
      allocations.map(
        (item) =>
          item.unitId,
      ),
    ),
  ];

  const allocationIds =
    allocations.map(
      (item) =>
        item.allocationId,
    );

  const [
    institutionalCourseUnits,
    institutionalSchemeUnits,
    trainerCourseAllocations,
    trainerSchemeAllocations,
  ] =
    await Promise.all([
      activeInstitutionalUnitIds(
        supabase as any,
        uniqueUnitIds,
        'course_outline',
      ),
      activeInstitutionalUnitIds(
        supabase as any,
        uniqueUnitIds,
        'scheme_of_work',
      ),
      activeTrainerAllocationIds(
        supabase as any,
        allocationIds,
        'course_outline',
      ),
      activeTrainerAllocationIds(
        supabase as any,
        allocationIds,
        'scheme_of_work',
      ),
    ]);

  const missingCourseOutlines =
    allocations.filter(
      (item) =>
        !institutionalCourseUnits.has(
          item.unitId,
        ) &&
        !trainerCourseAllocations.has(
          item.allocationId,
        ),
    );

  const missingSchemes =
    allocations.filter(
      (item) =>
        !institutionalSchemeUnits.has(
          item.unitId,
        ) &&
        !trainerSchemeAllocations.has(
          item.allocationId,
        ),
    );

  return {
    totalAllocations:
      allocations.length,
    activeCourseOutlines:
      allocations.length -
      missingCourseOutlines.length,
    activeSchemes:
      allocations.length -
      missingSchemes.length,
    missingCourseOutlines,
    missingSchemes,
  };
}
