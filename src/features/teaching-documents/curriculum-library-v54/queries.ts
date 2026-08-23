import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';
import type {
  CurriculumLibraryDocumentTypeV54,
  CurriculumLibraryDocumentV54,
  CurriculumLibraryHistoryV54,
} from './types';

async function loadUnits(
  supabase: any,
  unitIds: string[],
) {
  if (!unitIds.length) {
    return new Map<
      string,
      {
        code: string;
        name: string;
      }
    >();
  }

  const {
    data,
    error,
  } = await supabase
    .from('units')
    .select('id,code,name')
    .in('id', unitIds);

  if (error) {
    throw new Error(
      `Curriculum unit names could not be loaded: ${error.message}`,
    );
  }

  return new Map<
    string,
    {
      code: string;
      name: string;
    }
  >(
    (data ?? []).map(
      (unit: any) => [
        String(unit.id),
        {
          code: String(
            unit.code ?? '',
          ),
          name: String(
            unit.name ?? '',
          ),
        },
      ],
    ),
  );
}

function mergeDocumentRows(
  rows: any[],
  unitMap: Map<
    string,
    {
      code: string;
      name: string;
    }
  >,
): CurriculumLibraryDocumentV54[] {
  return rows
    .map((row: any) => {
      const unitId = String(
        row.unit_id,
      );
      const unit =
        unitMap.get(unitId);

      if (!unit) {
        return null;
      }

      return {
        id: String(row.id),
        unitId,
        unitCode: unit.code,
        unitName: unit.name,
        documentType:
          row.document_type as CurriculumLibraryDocumentTypeV54,
        versionNumber: Number(
          row.version_number,
        ),
        status: row.status,
        sourceType:
          row.source_type,
        sourceFileName:
          row.source_file_name
            ? String(
                row.source_file_name,
              )
            : null,
        createdAt: String(
          row.created_at,
        ),
      };
    })
    .filter(
      Boolean,
    ) as CurriculumLibraryDocumentV54[];
}

export async function getCurriculumLibraryV54() {
  const profile =
    await requireHodAccess();

  if (
    !profile.activeDepartmentId
  ) {
    return [] as CurriculumLibraryDocumentV54[];
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .select(
      'id,unit_id,document_type,version_number,status,source_type,source_file_name,created_at',
    )
    .eq(
      'department_id',
      profile.activeDepartmentId,
    )
    .eq('status', 'active')
    .order(
      'created_at',
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      `Curriculum library could not be loaded: ${error.message}`,
    );
  }

  const rows = data ?? [];

  const unitIds: string[] = [
    ...new Set<string>(
      rows.map(
        (row: any) =>
          String(
            row.unit_id,
          ),
      ),
    ),
  ];

  const unitMap =
    await loadUnits(
      supabase as any,
      unitIds,
    );

  return mergeDocumentRows(
    rows,
    unitMap,
  ).sort(
    (a, b) =>
      a.unitCode.localeCompare(
        b.unitCode,
      ) ||
      a.unitName.localeCompare(
        b.unitName,
      ) ||
      a.documentType.localeCompare(
        b.documentType,
      ),
  );
}

export async function getCurriculumLibraryCountV54() {
  const profile =
    await requireHodAccess();

  if (
    !profile.activeDepartmentId
  ) {
    return 0;
  }

  const supabase =
    await createClient();

  const {
    count,
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .select(
      'id',
      {
        count: 'exact',
        head: true,
      },
    )
    .eq(
      'department_id',
      profile.activeDepartmentId,
    )
    .eq(
      'status',
      'active',
    );

  if (error) {
    throw new Error(
      `Curriculum library count could not be loaded: ${error.message}`,
    );
  }

  return count ?? 0;
}

export async function getCurriculumDocumentHistoryV54(
  unitId: string,
  documentType:
    CurriculumLibraryDocumentTypeV54,
): Promise<CurriculumLibraryHistoryV54[]> {
  const profile =
    await requireHodAccess();

  if (
    !profile.activeDepartmentId
  ) {
    return [];
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .select(
      'id,unit_id,document_type,version_number,status,source_type,source_file_name,created_at',
    )
    .eq(
      'department_id',
      profile.activeDepartmentId,
    )
    .eq(
      'unit_id',
      unitId,
    )
    .eq(
      'document_type',
      documentType,
    )
    .order(
      'version_number',
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      `Curriculum version history could not be loaded: ${error.message}`,
    );
  }

  const rows = data ?? [];

  const unitMap =
    await loadUnits(
      supabase as any,
      [unitId],
    );

  return mergeDocumentRows(
    rows,
    unitMap,
  );
}
