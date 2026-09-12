import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import {
  findCanonicalCurriculum,
  getUnitCurriculum,
  normalizeUnitCodeKey,
  type UnitCurriculumDefinition,
} from '@/features/teaching-documents/curriculum-registry';

function enrichWithCanonical(
  def: UnitCurriculumDefinition,
  lookupCode: string,
  lookupName?: string,
): UnitCurriculumDefinition {
  const canonical = findCanonicalCurriculum(lookupCode, lookupName);
  if (!canonical) return def;

  // Harmonize weekly schedule: if def schedule is missing or has only single-line outcomes without multi-bullet depth, upgrade to canonical
  let weeklySchedule = def.weeklySchedule;
  const canonicalSchedule = canonical.weeklySchedule;
  const canonicalHasRichSLOs =
    canonicalSchedule &&
    canonicalSchedule.length > 0 &&
    canonicalSchedule.some((w) => Boolean(w.specificLearningOutcomes && w.specificLearningOutcomes.includes('\n•')));

  if (
    !weeklySchedule ||
    weeklySchedule.length === 0 ||
    (canonicalHasRichSLOs &&
      weeklySchedule.every((w) => !w.specificLearningOutcomes || !w.specificLearningOutcomes.includes('\n•')))
  ) {
    if (canonicalSchedule && canonicalSchedule.length > 0) {
      weeklySchedule = canonicalSchedule;
    }
  }

  return {
    ...def,
    unitDescription: def.unitDescription?.trim() ? def.unitDescription : canonical.unitDescription,
    overallCompetency: def.overallCompetency?.trim() ? def.overallCompetency : canonical.overallCompetency,
    learningOutcomes:
      def.learningOutcomes && def.learningOutcomes.length > 0
        ? def.learningOutcomes
        : (canonical.learningOutcomes ?? []),
    references:
      def.references && def.references.length > 0
        ? def.references
        : (canonical.references ?? []),
    instructionalEquipment:
      def.instructionalEquipment && def.instructionalEquipment.length > 0
        ? def.instructionalEquipment
        : (canonical.instructionalEquipment ?? []),
    weeklySchedule: weeklySchedule || canonical.weeklySchedule,
  };
}


export const getCurriculumContentImportBatch = cache(async (batchId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('curriculum_content_import_batches')
    .select('id,original_file_name,status,validation_summary,failure_message,created_at')
    .eq('id', batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

function cleanKey(val?: string | null): string {
  if (!val) return '';
  return val.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanResourceField(val: any): string | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (/lehninger|harper|biochemistry|edition|isbn/i.test(trimmed) || /^\d+\.\s+[A-Z]/i.test(trimmed)) {
    return undefined;
  }
  return trimmed || undefined;
}

function cleanReferenceList(val?: string | string[] | null, unitCode?: string, unitName?: string): string[] {
  if (!val) return [];
  const rawList = Array.isArray(val) ? val : [val];
  const cleaned: string[] = [];
  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/(?:^|\s+)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
    const entries = parts.length > 0 ? parts : [trimmed];
    for (const e of entries) {
      if (/lehninger|harper|biochemistry/i.test(e)) {
        const isBio = /biochem/i.test(unitCode || '') || /biochem/i.test(unitName || '');
        if (!isBio) continue;
      }
      const cleanEntry = e.replace(/^\d+\.\s*/, '').trim();
      if (cleanEntry) cleaned.push(cleanEntry);
    }
  }
  return cleaned;
}

export const getApprovedCurriculumForUnitCode = cache(
  async (
    unitCode: string,
    unitName?: string,
    documentType: 'course_outline' | 'scheme_of_work' = 'course_outline',
  ): Promise<UnitCurriculumDefinition> => {
    const supabase = await createClient();
    const targetKey = cleanKey(unitCode);
    const targetNameKey = cleanKey(unitName);

    if (!targetKey && !targetNameKey) {
      return getUnitCurriculum(unitCode, unitName || '');
    }

    // 1. Resolve unit from database with strict exact matching
    let unitId: string | null = null;
    let resolvedCode = unitCode;
    let resolvedName = unitName ?? '';

    try {
      const { data: allUnits } = await supabase
        .from('units')
        .select('id,code,name')
        .eq('is_active', true);

      if (allUnits && allUnits.length > 0) {
        // Priority A: Exact code match
        let matchedUnit = targetKey
          ? allUnits.find((u) => cleanKey(u.code) === targetKey)
          : null;

        // Priority B: Exact name match if no exact code match
        if (!matchedUnit && targetNameKey) {
          matchedUnit = allUnits.find(
            (u) => cleanKey(u.name) === targetNameKey
          ) ?? null;
        }

        if (matchedUnit) {
          unitId = matchedUnit.id;
          resolvedCode = matchedUnit.code;
          resolvedName = matchedUnit.name;
        }
      }
    } catch (err) {
      console.warn('Could not query units:', err);
    }

    // 2. Priority 0: Check trainer_teaching_document_versions (Trainer uploaded workbooks for this exact unit and document type)
    if (unitId) {
      try {
        const { data: trainerVersions } = await supabase
          .from('trainer_teaching_document_versions' as any)
          .select('source_payload,document_type')
          .eq('unit_id', unitId)
          .eq('document_type', documentType)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (trainerVersions && trainerVersions.length > 0) {
          const firstVer = trainerVersions[0];
          const payload = firstVer.source_payload as any;
          if (payload && Array.isArray(payload.content) && payload.content.length > 0) {
            // Verify payload code matches this unit to prevent cross-mapping
            const pCodeKey = cleanKey(payload.unitCode);
            if (!pCodeKey || pCodeKey === targetKey || (unitId && firstVer.unit_id === unitId)) {
              return enrichWithCanonical({
                unitCode: payload.unitCode || resolvedCode,
                unitName: payload.unitName || resolvedName,
                weeklySchedule: payload.content.map((row: any, idx: number) => ({
                  weekNumber: Number(row.sequence) || (idx + 1),
                  topicTitle: row.topic || `Topic ${idx + 1}`,
                  subTopics: row.coverage
                    ? String(row.coverage).split(/\s*[·;]\s*/).filter(Boolean)
                    : row.topic ? [row.topic] : [],
                  specificLearningOutcomes: row.learning_outcomes || undefined,
                  learningActivities: row.activities || undefined,
                  resourcesAndReferences: cleanResourceField(row.resources),
                  assessmentAndRemarks: row.assessment || undefined,
                })),
              }, resolvedCode || unitCode, resolvedName || unitName);
            }
          }
        }
      } catch (err) {
        console.warn('Could not query trainer_teaching_document_versions:', err);
      }
    }

    // 3. Priority 1: Check curriculum_document_versions (Admin library active versions for this exact unit)
    if (unitId) {
      try {
        const { data: versions } = await supabase
          .from('curriculum_document_versions' as any)
          .select('payload,document_type')
          .eq('unit_id', unitId)
          .eq('document_type', documentType)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (versions && versions.length > 0) {
          const firstVer = versions[0];
          const payload = firstVer.payload as any;
          if (payload && Array.isArray(payload.content) && payload.content.length > 0) {
            const unitMeta = payload.unit || {};
            const docCodeKey = cleanKey(unitMeta.unitCode);
            const docNameKey = cleanKey(unitMeta.unitName);

            // Strict validation: Must match target unit code or name
            if (
              !docCodeKey ||
              docCodeKey === targetKey ||
              (targetNameKey && docNameKey === targetNameKey)
            ) {
              return enrichWithCanonical({
                unitCode: unitMeta.unitCode || resolvedCode,
                unitName: unitMeta.unitName || resolvedName,
                unitDescription: unitMeta.unitDescription || undefined,
                overallCompetency: unitMeta.coreLearningOutcomes || undefined,
                learningOutcomes: unitMeta.coreLearningOutcomes
                  ? [unitMeta.coreLearningOutcomes]
                  : [],
                teachingLearningApproaches: unitMeta.teachingLearningApproaches || undefined,
                assessmentApproaches: unitMeta.assessmentApproaches || undefined,
                references: cleanReferenceList(unitMeta.referencesResources, resolvedCode, resolvedName),
                weeklySchedule: payload.content.map((row: any, idx: number) => ({
                  weekNumber: row.sourceWeek || row.sequence || (idx + 1),
                  topicTitle: row.topic || `Topic ${idx + 1}`,
                  subTopics: row.coverage
                    ? String(row.coverage).split(/\s*[·;]\s*/).filter(Boolean)
                    : row.topic ? [row.topic] : [],
                  specificLearningOutcomes: row.learningOutcomes || undefined,
                  learningActivities: row.activities || undefined,
                  resourcesAndReferences: cleanResourceField(row.resources),
                  assessmentAndRemarks: row.assessment || undefined,
                })),
              }, resolvedCode || unitCode, resolvedName || unitName);
            }
          }
        }
      } catch (err) {
        console.warn('Could not query curriculum_document_versions:', err);
      }
    }

    // 4. Priority 2: Check curriculum_content_import_batches (imported/staged payloads)
    try {
      const { data: batches } = await supabase
        .from('curriculum_content_import_batches')
        .select('payload')
        .in('status', ['imported', 'validated', 'staged'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (batches && batches.length > 0) {
        for (const batch of batches) {
          const payload = batch.payload as any;
          if (payload && Array.isArray(payload.units) && Array.isArray(payload.content)) {
            // Find unit in batch strictly by exact unit code or exact unit name
            const matchedUnitEntry = payload.units.find((u: any) => {
              const uCodeKey = cleanKey(u.matchedUnitCode || u.sourceUnitCode);
              const uNameKey = cleanKey(u.matchedUnitName || u.sourceUnitName);
              const uId = u.matchedUnitId;
              return (
                (unitId && uId === unitId) ||
                (targetKey && uCodeKey === targetKey) ||
                (targetNameKey && uNameKey === targetNameKey)
              );
            });

            if (matchedUnitEntry && matchedUnitEntry.sourceUnitKey) {
              const unitContent = payload.content.filter(
                (c: any) =>
                  c.sourceUnitKey === matchedUnitEntry.sourceUnitKey &&
                  !c.excludedAsCalendarActivity
              );

              if (unitContent.length > 0) {
                return enrichWithCanonical({
                  unitCode: matchedUnitEntry.matchedUnitCode || matchedUnitEntry.sourceUnitCode || resolvedCode,
                  unitName: matchedUnitEntry.matchedUnitName || matchedUnitEntry.sourceUnitName || resolvedName,
                  unitDescription: matchedUnitEntry.unitDescription || undefined,
                  overallCompetency: matchedUnitEntry.coreLearningOutcomes || undefined,
                  learningOutcomes: matchedUnitEntry.coreLearningOutcomes ? [matchedUnitEntry.coreLearningOutcomes] : [],
                  teachingLearningApproaches: matchedUnitEntry.teachingLearningApproaches || undefined,
                  assessmentApproaches: matchedUnitEntry.assessmentApproaches || undefined,
                  references: cleanReferenceList(matchedUnitEntry.referencesResources, resolvedCode, resolvedName),
                  weeklySchedule: unitContent.map((row: any, idx: number) => ({
                    weekNumber: row.week || row.sequence || (idx + 1),
                    topicTitle: row.topic || `Topic ${idx + 1}`,
                    subTopics: row.coverage
                      ? String(row.coverage).split(/\s*[·;]\s*/).filter(Boolean)
                      : row.subtopics ? String(row.subtopics).split(/\s*[·;]\s*/).filter(Boolean) : [row.topic],
                    specificLearningOutcomes: row.learningOutcomes || undefined,
                    learningActivities: row.activities || undefined,
                    resourcesAndReferences: cleanResourceField(row.resources),
                    assessmentAndRemarks: row.assessment || undefined,
                  })),
                }, resolvedCode || unitCode, resolvedName || unitName);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not query curriculum_content_import_batches:', err);
    }

    // 5. Priority 3: Check curriculum_unit_mappings & curriculum_families (relational)
    if (unitId) {
      try {
        const { data: mapping } = await supabase
          .from('curriculum_unit_mappings')
          .select('curriculum_family_id')
          .eq('unit_id', unitId)
          .maybeSingle();

        if (mapping) {
          const { data: family } = await supabase
            .from('curriculum_families')
            .select('id,name,unit_description,overall_competency,teaching_learning_approaches,assessment_approaches,status')
            .eq('id', mapping.curriculum_family_id)
            .maybeSingle();

          if (family) {
            const familyNameKey = cleanKey(family.name);
            const familyKey = cleanKey((family as any).family_key);

            // Strict check: Only return if the family actually matches this unit's code or name
            if (
              !targetNameKey ||
              familyNameKey === targetNameKey ||
              familyKey === targetKey
            ) {
              const [{ data: outcomes }, { data: weeks }, { data: references }] = await Promise.all([
                supabase.from('curriculum_learning_outcomes').select('sequence,learning_outcome').eq('curriculum_family_id', family.id).order('sequence'),
                supabase.from('curriculum_weeks').select('week_number,topic,specific_coverage,learning_outcomes,teaching_learning_activities,assessment_learning_check,resources').eq('curriculum_family_id', family.id).order('week_number'),
                supabase.from('curriculum_references').select('sequence,reference_resource').eq('curriculum_family_id', family.id).order('sequence'),
              ]);

              if (weeks && weeks.length > 0) {
                return enrichWithCanonical({
                  unitCode: resolvedCode,
                  unitName: resolvedName,
                  unitDescription: family.unit_description ?? undefined,
                  overallCompetency: family.overall_competency ?? undefined,
                  learningOutcomes: (outcomes ?? []).map((row) => row.learning_outcome),
                  weeklySchedule: weeks.map((row) => ({
                    weekNumber: row.week_number,
                    topicTitle: row.topic,
                    subTopics: row.specific_coverage ? row.specific_coverage.split(/\s*[·;]\s*/).filter(Boolean) : [],
                    learningActivities: row.teaching_learning_activities ?? undefined,
                    resourcesAndReferences: cleanResourceField(row.resources),
                    assessmentAndRemarks: row.assessment_learning_check ?? undefined,
                    specificLearningOutcomes: row.learning_outcomes ?? undefined,
                  })),
                  references: cleanReferenceList((references ?? []).map((row) => row.reference_resource), resolvedCode, resolvedName),
                  instructionalEquipment: [],
                  teachingLearningApproaches: family.teaching_learning_approaches ?? undefined,
                  assessmentApproaches: family.assessment_approaches ?? undefined,
                }, resolvedCode || unitCode, resolvedName || unitName);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not query curriculum_unit_mappings:', err);
      }
    }

    // 6. Priority 4: Check teaching_document_templates table (scoped composite ID first, then legacy)
    try {
      const codeKey = normalizeUnitCodeKey(unitCode);
      const scopedId = `tpl-tvet-${codeKey}-${documentType}`;
      const { data: scopedRow } = await supabase
        .from('teaching_document_templates')
        .select('original_filename')
        .eq('id', scopedId)
        .maybeSingle();

      if (scopedRow?.original_filename) {
        const parsed = JSON.parse(scopedRow.original_filename) as UnitCurriculumDefinition;
        if (parsed && cleanKey(parsed.unitCode) === targetKey) {
          return enrichWithCanonical(parsed, resolvedCode || unitCode, resolvedName || unitName);
        }
      }

      const legacyId = `tpl-tvet-${codeKey}`;
      const { data: row } = await supabase
        .from('teaching_document_templates')
        .select('original_filename')
        .eq('id', legacyId)
        .maybeSingle();

      if (row?.original_filename) {
        const parsed = JSON.parse(row.original_filename) as UnitCurriculumDefinition;
        if (parsed && cleanKey(parsed.unitCode) === targetKey) {
          return enrichWithCanonical(parsed, resolvedCode || unitCode, resolvedName || unitName);
        }
      }
    } catch {
      // Continue to fallback
    }

    // 7. Priority 5: Fallback to unpopulated structure (never load wrong unit)
    return getUnitCurriculum(resolvedCode || unitCode, resolvedName || unitName || '');
  }
);

