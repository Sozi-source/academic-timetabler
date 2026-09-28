/**
 * TVET Curriculum Registry & Seed Ingestion Engine
 *
 * Allows real unit course outlines and schemes of work to be seeded,
 * automatically retrieved for trainers, and polished into the standard
 * 14-week TVET template format.
 */

import {
  findCanonicalCurriculum,
  getAllCurriculumUnits,
  isCompatibleUnitTitle,
  MASTER_CURRICULUM_REGISTRY,
  type CanonicalCurriculumUnit,
  type SeedWeeklyTopic,
  type UnitCurriculumDefinition,
} from './curriculum-data';

export type { SeedWeeklyTopic, UnitCurriculumDefinition, CanonicalCurriculumUnit };
export { MASTER_CURRICULUM_REGISTRY, findCanonicalCurriculum, getAllCurriculumUnits, isCompatibleUnitTitle };


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
export const TVET_CURRICULUM_REGISTRY: Record<string, UnitCurriculumDefinition> = {
  cnd1101: {
    unitCode: 'CND 1101',
    unitName: 'Human Anatomy and Physiology',
    unitDescription: 'Comprehensive study of human cellular biology, organ systems, physiological regulation and anatomical relationships.',
    overallCompetency: 'Apply anatomical and physiological principles in clinical nutrition assessment and dietary management.',
    learningOutcomes: [
      'Explain cellular organization and fundamental tissue classification.',
      'Analyze the structure and function of the cardiovascular and respiratory systems.',
      'Describe the digestive system and nutrient absorption mechanisms.',
    ],
    weeklySchedule: [
      { weekNumber: 1, topicTitle: 'Cellular Biology & Cell Physiology', subTopics: ['Cell structure', 'Organelles', 'Membrane transport'] },
      { weekNumber: 2, topicTitle: 'Epithelial, Connective & Muscular Tissues', subTopics: ['Tissue types', 'Histology', 'Functional integration'] },
      { weekNumber: 3, topicTitle: 'Cardiovascular System & Hemodynamics', subTopics: ['Heart anatomy', 'Blood vessels', 'Systemic circulation'] },
      { weekNumber: 4, topicTitle: 'Blood Components & Immune Mechanisms', subTopics: ['Erythrocytes', 'Leukocytes', 'Coagulation cascade'] },
      { weekNumber: 5, topicTitle: 'Continuous Assessment 1 (RAT 1)', subTopics: ['Assessment covering Weeks 1 to 4'] },
      { weekNumber: 6, topicTitle: 'Respiratory System & Gas Exchange', subTopics: ['Upper and lower tract', 'Pulmonary ventilation', 'Gas transport'] },
      { weekNumber: 7, topicTitle: 'Digestive System & Gastrointestinal Tract', subTopics: ['GI tract anatomy', 'Accessory digestive organs', 'Enzymatic digestion'] },
      { weekNumber: 8, topicTitle: 'Mid-Term CAT (Official Examination)', subTopics: ['Comprehensive evaluation of Weeks 1 to 7'] },
      { weekNumber: 9, topicTitle: 'Renal System & Fluid Electrolyte Balance', subTopics: ['Nephron physiology', 'Urine formation', 'Acid-base regulation'] },
      { weekNumber: 10, topicTitle: 'Endocrine Regulation & Hormonal Control', subTopics: ['Pituitary axis', 'Thyroid and pancreas', 'Metabolic hormones'] },
      { weekNumber: 11, topicTitle: 'Nervous System & Neurotransmission', subTopics: ['Central and peripheral NS', 'Action potentials', 'Synaptic transmission'] },
      { weekNumber: 12, topicTitle: 'Reproductive System & Embryology', subTopics: ['Male and female reproductive anatomy', 'Gametogenesis'] },
      { weekNumber: 13, topicTitle: 'Comprehensive Syllabus Revision & Tutorial Clinic', subTopics: ['Remediation and past paper analysis'] },
      { weekNumber: 14, topicTitle: 'Final Summative Examination', subTopics: ['Institutional TVET final theory and practical exams'] },
    ],
    references: ['Ross & Wilson Anatomy and Physiology in Health and Illness (13th Edition)'],
    instructionalEquipment: ['Anatomical charts and models', 'Laboratory microscopes and prepared slides'],
  },
};

/**
 * Finds a unit curriculum definition by matching code or name.
 * Automatically resolves shared aliases between CND and DND programmes.
 */
export function getUnitCurriculum(
  unitCode: string,
  unitName: string
): UnitCurriculumDefinition {
  const codeKey = normalizeUnitCodeKey(unitCode);

  // 1. Direct code lookup in dynamic registry (both bare and scoped) for custom user overrides
  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }
  if (TVET_CURRICULUM_REGISTRY[`${codeKey}:course_outline`]) {
    return TVET_CURRICULUM_REGISTRY[`${codeKey}:course_outline`];
  }
  if (TVET_CURRICULUM_REGISTRY[`${codeKey}:scheme_of_work`]) {
    return TVET_CURRICULUM_REGISTRY[`${codeKey}:scheme_of_work`];
  }

  // 2. Authoritative KNEC TVET Curriculum Data Resolution (with CND <-> DND Shared Alias Mapping)
  const canonical = findCanonicalCurriculum(unitCode, unitName);
  if (canonical) {
    return {
      ...canonical,
      unitCode: unitCode.trim() || canonical.unitCode,
      unitName: unitName.trim() || canonical.unitName,
    };
  }

  // 3. Dynamic registry exact name search (strictly exact normalized match)
  const normTargetName = normalizeUnitCodeKey(unitName);
  if (normTargetName) {
    for (const def of Object.values(TVET_CURRICULUM_REGISTRY)) {
      if (normalizeUnitCodeKey(def.unitName) === normTargetName) {
        return {
          ...def,
          unitCode,
          unitName,
        };
      }
    }
  }

  // 4. Fallback: Return empty/unpopulated unit structure with clear not-ready flag (never fabricate topics)
  return {
    unitCode,
    unitName,
    unitDescription: 'Curriculum content for this unit is currently pending official TVET syllabus document ingestion.',
    overallCompetency: 'Pending official syllabus upload.',
    learningOutcomes: [],
    weeklySchedule: [],
    references: [],
    instructionalEquipment: [],
    isAvailable: false,
    notReadyMessage: `Curriculum content for ${unitCode} (${unitName}) is not yet available. The official course outline and scheme of work will be published once the syllabus document is uploaded by the department.`,
  };
}

/**
 * Register custom seed documents dynamically or in batches
 */
export function registerUnitCurriculum(def: UnitCurriculumDefinition) {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  TVET_CURRICULUM_REGISTRY[codeKey] = def;
  if (def.documentType) {
    TVET_CURRICULUM_REGISTRY[`${codeKey}:${def.documentType}`] = def;
  }
}

/**
 * Persists an ingested unit curriculum definition into Supabase.
 *
 * The template ID is scoped by document type (`tpl-tvet-<code>-<type>`) so that
 * a scheme_of_work and a course_outline for the same unit code never overwrite
 * each other — matching the composite ID convention in AGENTS.md.
 */
export async function persistUnitCurriculumToDatabase(def: UnitCurriculumDefinition): Promise<void> {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  // Use the actual document type from the definition; default to 'course_outline' only
  // when none was supplied (e.g. a direct programmatic call without a type tag).
  const docType = def.documentType ?? 'course_outline';
  const templateId = `tpl-tvet-${codeKey}-${docType}`;
  const registryKey = `${codeKey}:${docType}`;

  TVET_CURRICULUM_REGISTRY[registryKey] = def;

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin.from('teaching_document_templates').upsert({
      id: templateId,
      document_type: docType,
      name: def.unitCode,
      version_number: 1,
      status: 'active',
      storage_bucket: 'teaching-documents',
      storage_path: `curriculum/${codeKey}-${docType}.json`,
      original_filename: JSON.stringify(def),
      notes: def.unitName,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to persist curriculum definition to DB:', err);
  }
}

/**
 * Loads a persisted unit curriculum definition from Supabase.
 *
 * @param documentType - Distinguishes scheme_of_work from course_outline lookups.
 *   Defaults to 'course_outline'. Pass 'scheme_of_work' when building a Scheme
 *   of Work or when pre-loading curriculum for the Record of Work generator.
 */
export async function loadPersistedUnitCurriculum(
  unitCode: string,
  unitName: string,
  documentType: 'course_outline' | 'scheme_of_work' = 'course_outline',
): Promise<UnitCurriculumDefinition> {
  const codeKey = normalizeUnitCodeKey(unitCode);
  const registryKey = `${codeKey}:${documentType}`;

  if (TVET_CURRICULUM_REGISTRY[registryKey]) {
    return TVET_CURRICULUM_REGISTRY[registryKey];
  }

  // Also check the legacy unscoped registry key for backwards compatibility with
  // definitions that were registered before the type-scoped fix was applied.
  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // Primary lookup: scoped composite ID (new format)
    const scopedId = `tpl-tvet-${codeKey}-${documentType}`;
    const { data: scopedRow } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', scopedId)
      .maybeSingle();

    if (scopedRow?.original_filename) {
      const parsed = JSON.parse(scopedRow.original_filename) as UnitCurriculumDefinition;
      if (parsed && parsed.unitCode) {
        TVET_CURRICULUM_REGISTRY[registryKey] = parsed;
        return parsed;
      }
    }

    // Fallback lookup: legacy unscoped ID (old format, pre-fix)
    const legacyId = `tpl-tvet-${codeKey}`;
    const { data: legacyRow } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', legacyId)
      .maybeSingle();

    if (legacyRow?.original_filename) {
      const parsed = JSON.parse(legacyRow.original_filename) as UnitCurriculumDefinition;
      if (parsed && parsed.unitCode) {
        TVET_CURRICULUM_REGISTRY[registryKey] = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to sync getUnitCurriculum
  }

  return getUnitCurriculum(unitCode, unitName);
}
