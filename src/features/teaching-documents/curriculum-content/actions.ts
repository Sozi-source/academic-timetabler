'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import { parseCurriculumContentWorkbook } from './workbook';

import type { CurriculumContentImportState } from './types';

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g,' ');
}

export async function stageCurriculumContentImportAction(
  _previous: CurriculumContentImportState,
  formData: FormData,
): Promise<CurriculumContentImportState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status:'error', message:'No active department selected.' };
  const file = formData.get('workbook');
  if (!(file instanceof File)) return { status:'error', message:'Select the Curriculum Content Excel workbook.' };
  if (!file.name.toLowerCase().endsWith('.xlsx')) return { status:'error', message:'Use the official Excel (.xlsx) template.' };
  if (file.size > 50 * 1024 * 1024) return { status:'error', message:'Workbook exceeds the 50 MB limit.' };

  let parsed: Awaited<ReturnType<typeof parseCurriculumContentWorkbook>>;
  try {
    parsed = await parseCurriculumContentWorkbook(await file.arrayBuffer());
  } catch (error) {
    return { status:'error', message:error instanceof Error ? error.message : 'Workbook could not be read.' };
  }
  if (parsed.errors.length > 0) return { status:'error', message:'Workbook validation failed.', details:parsed.errors.slice(0,30) };

  const supabase = await createClient();
  const codes: string[] = Array.from(new Set<string>(parsed.unitMappings.map((r) => normalizeCode(r.unit_code))));
  const { data: units, error: unitError } = await supabase
    .from('units')
    .select('id,code,name,department_id,is_active')
    .in('code', codes)
    .eq('is_active', true);
  if (unitError) return { status:'error', message:`Units could not be checked: ${unitError.message}` };

  const unitMap = new Map<string, { id:string; code:string; name:string; department_id:string | null; is_active:boolean }>(
    (units ?? []).map((u) => [normalizeCode(String(u.code)), u as { id:string; code:string; name:string; department_id:string | null; is_active:boolean }]),
  );
  const missing = codes.filter((code) => !unitMap.has(code));
  if (missing.length) return { status:'error', message:'Some unit codes do not exist in Academic Planner.', details:missing.map((code) => `Unknown unit code: ${code}`) };

  const metadataByFamily = new Map<string, Record<string,string>>(
    parsed.curriculum.map((r): [string, Record<string,string>] => [r.content_family_key, r]),
  );
  const families = [...metadataByFamily.entries()].map(([familyKey,meta]) => ({
    familyKey,
    familyName: meta.content_family_name || familyKey,
    version: Number(meta.curriculum_version || 1),
    unitDescription: meta.unit_description || '',
    overallCompetency: meta.overall_competency || '',
    teachingLearningApproaches: meta.teaching_learning_approaches || '',
    assessmentApproaches: meta.assessment_approaches || '',
    learningOutcomes: parsed.outcomes
      .filter((r) => r.content_family_key === familyKey && r.learning_outcome)
      .map((r) => ({ sequence:Number(r.sequence || 1), text:r.learning_outcome })),
    weeks: parsed.weeks
      .filter((r) => r.content_family_key === familyKey)
      .map((r) => ({
        weekNumber:Number(r.week_number), topic:r.topic, specificCoverage:r.specific_coverage || '',
        learningOutcomes:r.learning_outcomes || '', teachingLearningActivities:r.teaching_learning_activities || '',
        assessmentLearningCheck:r.assessment_learning_check || '', resources:r.resources || '',
      }))
      .sort((a,b) => a.weekNumber - b.weekNumber),
    references: parsed.references
      .filter((r) => r.content_family_key === familyKey && r.reference_resource)
      .map((r) => ({ sequence:Number(r.sequence || 1), text:r.reference_resource })),
    unitMappings: parsed.unitMappings
      .filter((r) => r.content_family_key === familyKey)
      .map((r,index) => ({ unitId:unitMap.get(normalizeCode(r.unit_code))!.id, unitCode:normalizeCode(r.unit_code), isPrimary:index === 0 })),
  }));

  const { data: batch, error: batchError } = await supabase
    .from('curriculum_content_import_batches')
    .insert({
      department_id:profile.activeDepartmentId,
      original_file_name:file.name,
      template_version:parsed.templateVersion,
      status:'validated',
      payload:{ families },
      validation_summary:{
        families:families.length,
        units:parsed.unitMappings.length,
        weeks:parsed.weeks.length,
        outcomes:parsed.outcomes.length,
        references:parsed.references.length,
        warnings:parsed.warnings,
      },
      created_by:profile.id,
    })
    .select('id')
    .single();
  if (batchError || !batch) return { status:'error', message:batchError?.message ?? 'Validation batch could not be created.' };

  return { status:'success', message:'Curriculum content validated. Review before importing.', batchId:batch.id };
}

export async function confirmCurriculumContentImportAction(formData: FormData) {
  await requireHodAccess();
  const batchId = String(formData.get('batchId') ?? '').trim();
  if (!batchId) throw new Error('Missing curriculum content import batch.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_curriculum_content_batch',{ target_batch_id:batchId });
  if (error) throw new Error(error.message);
  revalidatePath('/teaching-documents');
  revalidatePath('/teaching-documents/curriculum/import');
  return data;
}
