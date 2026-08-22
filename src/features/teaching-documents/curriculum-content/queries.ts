import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UnitCurriculumDefinition } from '@/features/teaching-documents/curriculum-registry';

export const getCurriculumContentImportBatch = cache(async (batchId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('curriculum_content_import_batches')
    .select('id,original_file_name,status,validation_summary,failure_message,created_at')
    .eq('id',batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getApprovedCurriculumForUnitCode = cache(async (unitCode: string, unitName?: string): Promise<UnitCurriculumDefinition | null> => {
  const supabase = await createClient();
  let unitQuery = supabase.from('units').select('id,code,name').eq('code',unitCode).eq('is_active',true).limit(1);
  if (unitName?.trim()) unitQuery = unitQuery.eq('name',unitName.trim());
  const { data: unit, error: unitError } = await unitQuery.maybeSingle();
  if (unitError) throw new Error(unitError.message);
  if (!unit) return null;

  const { data: mapping, error: mappingError } = await supabase
    .from('curriculum_unit_mappings')
    .select('curriculum_family_id')
    .eq('unit_id',unit.id)
    .maybeSingle();
  if (mappingError) throw new Error(mappingError.message);
  if (!mapping) return null;

  const { data: family, error: familyError } = await supabase
    .from('curriculum_families')
    .select('id,name,unit_description,overall_competency,teaching_learning_approaches,assessment_approaches,status')
    .eq('id',mapping.curriculum_family_id)
    .eq('status','approved')
    .maybeSingle();
  if (familyError) throw new Error(familyError.message);
  if (!family) return null;

  const [{ data: outcomes },{ data: weeks },{ data: references }] = await Promise.all([
    supabase.from('curriculum_learning_outcomes').select('sequence,learning_outcome').eq('curriculum_family_id',family.id).order('sequence'),
    supabase.from('curriculum_weeks').select('week_number,topic,specific_coverage,learning_outcomes,teaching_learning_activities,assessment_learning_check,resources').eq('curriculum_family_id',family.id).order('week_number'),
    supabase.from('curriculum_references').select('sequence,reference_resource').eq('curriculum_family_id',family.id).order('sequence'),
  ]);

  return {
    unitCode:unit.code,
    unitName:unit.name,
    unitDescription:family.unit_description ?? undefined,
    overallCompetency:family.overall_competency ?? undefined,
    learningOutcomes:(outcomes ?? []).map((row) => row.learning_outcome),
    weeklySchedule:(weeks ?? []).map((row) => ({
      weekNumber:row.week_number,
      topicTitle:row.topic,
      subTopics:row.specific_coverage ? row.specific_coverage.split(/\s*[·;]\s*/).filter(Boolean) : [],
      learningActivities:row.teaching_learning_activities ?? undefined,
      resourcesAndReferences:row.resources ?? undefined,
      assessmentAndRemarks:row.assessment_learning_check ?? undefined,
      specificLearningOutcomes:row.learning_outcomes ?? undefined,
    })),
    references:(references ?? []).map((row) => row.reference_resource),
    instructionalEquipment:[],
    teachingLearningApproaches:family.teaching_learning_approaches ?? undefined,
    assessmentApproaches:family.assessment_approaches ?? undefined,
  } as UnitCurriculumDefinition;
});
