/**
 * TVET Curriculum Registry & Seed Ingestion Engine
 *
 * Allows real unit course outlines and schemes of work to be seeded,
 * automatically retrieved for trainers, and polished into the standard
 * 14-week TVET template format.
 */

export interface SeedWeeklyTopic {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  hours?: number;
  learningActivities?: string;
  resourcesAndReferences?: string;
  assessmentAndRemarks?: string;
  specificLearningOutcomes?: string;
}

export interface UnitCurriculumDefinition {
  /** Legacy ingestion tag retained for ZIP/import compatibility. */
  documentType?: 'course_outline' | 'scheme_of_work';
  unitCode: string;
  unitName: string;
  unitDescription?: string;
  overallCompetency?: string;
  learningOutcomes?: string[];
  weeklySchedule?: SeedWeeklyTopic[];
  references?: string[];
  instructionalEquipment?: string[];
  teachingLearningApproaches?: string;
  assessmentApproaches?: string;
}

/**
 * Normalizes a unit code for robust lookup (e.g. "CND 1101" -> "cnd1101")
 */
export function normalizeUnitCodeKey(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Dynamic TVET Standard Curriculum Registry
 * Populated dynamically from uploaded workbooks, import batches, and database records.
 */
export const TVET_CURRICULUM_REGISTRY: Record<string, UnitCurriculumDefinition> = {};

/**
 * Finds a unit curriculum definition by matching code or name
 */
export function getUnitCurriculum(
  unitCode: string,
  unitName: string
): UnitCurriculumDefinition {
  const codeKey = normalizeUnitCodeKey(unitCode);

  // 1. Direct code lookup in dynamic registry
  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }

  // 2. Name search
  for (const def of Object.values(TVET_CURRICULUM_REGISTRY)) {
    if (
      def.unitName.toLowerCase().includes(unitName.toLowerCase()) ||
      unitName.toLowerCase().includes(def.unitName.toLowerCase())
    ) {
      return {
        ...def,
        unitCode,
        unitName,
      };
    }
  }

  // 3. Fallback: Return empty/unpopulated unit structure (never fabricate topics)
  return {
    unitCode,
    unitName,
    unitDescription: '',
    overallCompetency: '',
    learningOutcomes: [],
    weeklySchedule: [],
    references: [],
    instructionalEquipment: [],
  };
}

/**
 * Register custom seed documents dynamically or in batches
 */
export function registerUnitCurriculum(def: UnitCurriculumDefinition) {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  TVET_CURRICULUM_REGISTRY[codeKey] = def;
}

/**
 * Persists an ingested unit curriculum definition into Supabase
 */
export async function persistUnitCurriculumToDatabase(def: UnitCurriculumDefinition): Promise<void> {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  TVET_CURRICULUM_REGISTRY[codeKey] = def;

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin.from('teaching_document_templates').upsert({
      id: `tpl-tvet-${codeKey}`,
      document_type: 'course_outline',
      name: def.unitCode,
      version_number: 1,
      status: 'active',
      storage_bucket: 'teaching-documents',
      storage_path: `curriculum/${codeKey}.json`,
      original_filename: JSON.stringify(def),
      notes: def.unitName,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to persist curriculum definition to DB:', err);
  }
}

/**
 * Loads a persisted unit curriculum definition from Supabase
 */
export async function loadPersistedUnitCurriculum(
  unitCode: string,
  unitName: string,
  _documentType?: 'course_outline' | 'scheme_of_work',
): Promise<UnitCurriculumDefinition> {
  const codeKey = normalizeUnitCodeKey(unitCode);

  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', `tpl-tvet-${codeKey}`)
      .maybeSingle();

    if (row?.original_filename) {
      const parsed = JSON.parse(row.original_filename) as UnitCurriculumDefinition;
      if (parsed && parsed.unitCode) {
        TVET_CURRICULUM_REGISTRY[codeKey] = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to sync getUnitCurriculum
  }

  return getUnitCurriculum(unitCode, unitName);
}
