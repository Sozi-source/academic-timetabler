'use server';

import { revalidatePath } from 'next/cache';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDocxSyllabus } from './docx-parser';

export interface OnlineTopicItem {
  id: string;
  topicTitle: string;
  subTopics: string;
  learningOutcomes?: string;
  activities?: string;
  resources?: string;
}

export interface OnlineCurriculumPayload {
  unitId?: string;
  unitCode: string;
  unitName: string;
  unitDescription: string;
  overallCompetencies: string;
  references: string;
  topics: OnlineTopicItem[];
}

export async function parseDocxSyllabusAction(formData: FormData) {
  await requireTrainerAccess();
  const file = formData.get('file') as File | null;
  if (!file) {
    throw new Error('Please select a Word (.docx) document.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = parseDocxSyllabus(buffer);

  if (parsed.topics.length === 0) {
    throw new Error('No syllabus topics or tables could be extracted from this Word document. Please ensure it contains a topic table or numbered topics.');
  }

  return {
    success: true,
    data: parsed,
  };
}

export async function saveOnlineCurriculumAction(payload: OnlineCurriculumPayload) {
  const profile = await requireTrainerAccess();

  if (!payload.unitCode?.trim()) {
    throw new Error('Please specify a unit code (e.g. DHN 2304).');
  }

  if (!payload.topics || payload.topics.length === 0) {
    throw new Error('Please add at least one topic for the syllabus.');
  }

  const admin = createAdminClient();
  let targetUnitId = payload.unitId;

  // Resolve or create unit in units table
  if (!targetUnitId) {
    const { data: existingUnit } = await admin
      .from('units')
      .select('id')
      .ilike('code', payload.unitCode.trim())
      .maybeSingle();

    if (existingUnit) {
      targetUnitId = existingUnit.id;
    } else {
      const { data: newUnit, error: createUnitError } = await admin
        .from('units')
        .insert({
          code: payload.unitCode.trim().toUpperCase(),
          name: payload.unitName.trim() || payload.unitCode.trim(),
          is_active: true,
        })
        .select('id')
        .single();

      if (createUnitError) {
        throw new Error(`Failed to create unit: ${createUnitError.message}`);
      }
      targetUnitId = newUnit.id;
    }
  }

  // 1. Fetch current max version for this unit
  const { data: existingVersions } = await admin
    .from('curriculum_document_versions')
    .select('version_number')
    .eq('unit_id', targetUnitId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (existingVersions?.[0]?.version_number ?? 0) + 1;

  // 2. Mark previous versions as superseded
  await admin
    .from('curriculum_document_versions')
    .update({ status: 'superseded' })
    .eq('unit_id', targetUnitId)
    .eq('status', 'active');

  // 3. Construct structured payload
  const formattedContent = payload.topics.map((t, idx) => ({
    sequence: idx + 1,
    topic: t.topicTitle.trim(),
    coverage: t.subTopics.trim(),
    learningOutcomes: t.learningOutcomes?.trim() || '',
    activities: t.activities?.trim() || '',
    resources: t.resources?.trim() || '',
  }));

  const documentPayload = {
    unit: {
      unitId: targetUnitId,
      unitCode: payload.unitCode.trim().toUpperCase(),
      unitName: payload.unitName.trim() || payload.unitCode.trim(),
      unitDescription: payload.unitDescription,
      coreLearningOutcomes: payload.overallCompetencies,
      referencesResources: payload.references,
    },
    content: formattedContent,
  };

  // 4. Insert active version
  let targetDepartmentId = profile.activeDepartmentId;
  if (!targetDepartmentId) {
    const { data: uData } = await admin
      .from('units')
      .select('department_id')
      .eq('id', targetUnitId)
      .maybeSingle();
    targetDepartmentId = uData?.department_id ?? (profile as any).departmentId;
  }
  if (!targetDepartmentId) {
    const { data: dept } = await admin.from('departments').select('id').limit(1).maybeSingle();
    targetDepartmentId = dept?.id;
  }

  const { data: newDoc, error: insertError } = await admin
    .from('curriculum_document_versions')
    .insert({
      department_id: targetDepartmentId,
      unit_id: targetUnitId,
      document_type: 'course_outline',
      version_number: nextVersion,
      status: 'active',
      created_by: profile.id,
      payload: documentPayload,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to save curriculum: ${insertError.message}`);
  }

  // 5. Revalidate paths
  revalidatePath('/teaching-documents');
  revalidatePath('/teaching-documents/curriculum');
  revalidatePath('/staff/documents');
  revalidatePath('/staff/units/[allocationId]/documents', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');

  return {
    success: true,
    documentId: newDoc?.id,
    message: `Curriculum for ${payload.unitCode} saved and published successfully!`,
  };
}
