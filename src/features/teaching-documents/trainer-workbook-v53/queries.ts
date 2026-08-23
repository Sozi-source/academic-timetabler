import { createClient } from '@/lib/supabase/server';
import { TRAINER_ALLOCATION_TABLE } from './config';
import type {
  TrainerAllocationDocumentRowV53,
  TrainerDocumentSummaryV53,
  TrainerTeachingDocumentType,
} from './types';

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('You must be signed in.');
  }

  return { supabase, user };
}

export async function loadAccessibleTrainerAllocationsV53() {
  const { supabase } = await currentUser();

  // RLS on the existing allocation table remains the authority for which
  // allocations a trainer can see. We intentionally request only identity
  // fields that are required for workbook generation.
  const { data: allocations, error } = await (supabase as any)
    .from(TRAINER_ALLOCATION_TABLE)
    .select('id,unit_id')
    .not('unit_id', 'is', null);

  if (error) {
    throw new Error(
      `Trainer allocations could not be loaded from ${TRAINER_ALLOCATION_TABLE}: ${error.message}`,
    );
  }

  const cleanAllocations = (allocations ?? [])
    .filter((row: any) => row?.id && row?.unit_id)
    .map((row: any) => ({
      allocationId: String(row.id),
      unitId: String(row.unit_id),
    }));

  const unitIds = [
    ...new Set(
      cleanAllocations.map(
        (row: { unitId: string }) => row.unitId,
      ),
    ),
  ];

  if (!unitIds.length) {
    return [] as TrainerAllocationDocumentRowV53[];
  }

  const { data: units, error: unitsError } = await (supabase as any)
    .from('units')
    .select('id,code,name')
    .in('id', unitIds);

  if (unitsError) {
    throw new Error(
      `Allocated units could not be loaded: ${unitsError.message}`,
    );
  }

  const unitMap = new Map<
    string,
    {
      unitCode: string;
      unitName: string;
    }
  >(
    (units ?? []).map((unit: any) => [
      String(unit.id),
      {
        unitCode: String(unit.code ?? ''),
        unitName: String(unit.name ?? ''),
      },
    ]),
  );

  return cleanAllocations
    .map((allocation: { allocationId: string; unitId: string }) => {
      const unit = unitMap.get(allocation.unitId);

      if (!unit) return null;

      return {
        allocationId: allocation.allocationId,
        unitId: allocation.unitId,
        unitCode: unit.unitCode,
        unitName: unit.unitName,
      };
    })
    .filter(Boolean) as TrainerAllocationDocumentRowV53[];
}

export async function loadMissingTrainerDocumentsV53(
  documentType: TrainerTeachingDocumentType,
) {
  const { supabase } = await currentUser();
  const allocations = await loadAccessibleTrainerAllocationsV53();

  if (!allocations.length) {
    return [] as TrainerAllocationDocumentRowV53[];
  }

  const allocationIds = allocations.map(
    (item) => item.allocationId,
  );

  const { data: activeRows, error } = await (supabase as any)
    .from('trainer_teaching_document_versions')
    .select('allocation_id')
    .in('allocation_id', allocationIds)
    .eq('document_type', documentType)
    .eq('status', 'active');

  if (error) {
    throw new Error(
      `Current teaching documents could not be loaded: ${error.message}`,
    );
  }

  const completed = new Set(
    (activeRows ?? []).map(
      (row: any) => String(row.allocation_id),
    ),
  );

  return allocations.filter(
    (item) => !completed.has(item.allocationId),
  );
}

export async function loadTrainerDocumentSummaryV53(): Promise<TrainerDocumentSummaryV53> {
  const { supabase } = await currentUser();
  const allocations = await loadAccessibleTrainerAllocationsV53();

  if (!allocations.length) {
    return {
      totalAllocations: 0,
      activeCourseOutlines: 0,
      activeSchemes: 0,
      missingCourseOutlines: [],
      missingSchemes: [],
    };
  }

  const allocationIds = allocations.map(
    (item) => item.allocationId,
  );

  const { data: versions, error } = await (supabase as any)
    .from('trainer_teaching_document_versions')
    .select('allocation_id,document_type')
    .in('allocation_id', allocationIds)
    .eq('status', 'active');

  if (error) {
    throw new Error(
      `Teaching document status could not be loaded: ${error.message}`,
    );
  }

  const courseSet = new Set<string>();
  const schemeSet = new Set<string>();

  for (const row of versions ?? []) {
    if (row.document_type === 'course_outline') {
      courseSet.add(String(row.allocation_id));
    }

    if (row.document_type === 'scheme_of_work') {
      schemeSet.add(String(row.allocation_id));
    }
  }

  return {
    totalAllocations: allocations.length,
    activeCourseOutlines: courseSet.size,
    activeSchemes: schemeSet.size,
    missingCourseOutlines: allocations.filter(
      (item) => !courseSet.has(item.allocationId),
    ),
    missingSchemes: allocations.filter(
      (item) => !schemeSet.has(item.allocationId),
    ),
  };
}
