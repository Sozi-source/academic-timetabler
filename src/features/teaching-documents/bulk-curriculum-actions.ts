'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseBulkCourseOutlineWorkbook,
  parseBulkCourseOutlineZip,
  type BulkCourseOutlineUnit,
  type BulkParseResult,
  type SystemUnitLookup,
} from './bulk-curriculum-parser';
import {
  normalizeUnitCodeKey,
  TVET_CURRICULUM_REGISTRY,
} from './curriculum-registry';
import { hasTopicCoverageContamination } from './topic-coverage-validation';

/**
 * Parses an uploaded file (either .xlsx or .zip) and returns the extracted units and matching status
 */
export async function parseBulkCourseOutlinesAction(formData: FormData): Promise<BulkParseResult> {
  await requireHodAccess();

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return {
      ok: false,
      error: 'Please select a valid Excel workbook (.xlsx) or ZIP archive (.zip).',
      fileName: '',
      fileType: 'xlsx',
      totalUnits: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      units: [],
      issues: [{ severity: 'error', message: 'No file uploaded.' }],
    };
  }

  const fileName = file.name;
  const isZip = fileName.toLowerCase().endsWith('.zip');
  const isXlsx = fileName.toLowerCase().endsWith('.xlsx');

  if (!isZip && !isXlsx) {
    return {
      ok: false,
      error: 'Unsupported file format. Please upload an Excel workbook (.xlsx) or ZIP archive (.zip).',
      fileName,
      fileType: 'xlsx',
      totalUnits: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      units: [],
      issues: [{ severity: 'error', message: 'Unsupported file format.' }],
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const admin = createAdminClient();
  const { data: unitsData } = await admin
    .from('units')
    .select('id, code, name')
    .eq('is_active', true);

  const systemUnits: SystemUnitLookup[] = (unitsData ?? []).map((u) => ({
    id: String(u.id),
    code: String(u.code),
    name: String(u.name),
  }));

  if (isZip) {
    return parseBulkCourseOutlineZip(buffer, fileName, systemUnits);
  } else {
    return parseBulkCourseOutlineWorkbook(buffer, fileName, systemUnits);
  }
}

/**
 * Commits verified course outlines directly into the authoritative central document library
 */
export async function commitBulkCourseOutlinesAction(
  units: BulkCourseOutlineUnit[],
  sourceFileName?: string,
): Promise<{ success: boolean; count: number; message: string; error?: string }> {
  const profile = await requireHodAccess();

  if (!units || units.length === 0) {
    return { success: false, count: 0, message: 'No units to commit.' };
  }

  const malformedUnit = units.find((item) => hasTopicCoverageContamination(item.topics));
  if (malformedUnit) {
    return {
      success: false,
      count: 0,
      message: `Unit "${malformedUnit.unitCode}" has topic titles mixed with subtopic content. Correct the topic and coverage columns before publishing.`,
    };
  }

  const admin = createAdminClient();
  let committedCount = 0;

  // Resolve target department
  let targetDepartmentId = profile.activeDepartmentId;
  if (!targetDepartmentId) {
    const { data: dept } = await admin.from('departments').select('id').limit(1).maybeSingle();
    targetDepartmentId = dept?.id;
  }

  for (const item of units) {
    if (!item.unitCode?.trim() || item.topics.length === 0) {
      continue;
    }

    let targetUnitId = item.matchedUnitId;

    // If unit wasn't pre-matched, check or create in units table
    if (!targetUnitId) {
      const { data: existingUnit } = await admin
        .from('units')
        .select('id')
        .ilike('code', item.unitCode.trim())
        .maybeSingle();

      if (existingUnit) {
        targetUnitId = existingUnit.id;
      } else {
        const { data: newUnit, error: createError } = await admin
          .from('units')
          .insert({
            code: item.unitCode.trim().toUpperCase(),
            name: item.unitName.trim() || item.unitCode.trim().toUpperCase(),
            department_id: targetDepartmentId,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create unit for ${item.unitCode}:`, createError);
          continue;
        }
        targetUnitId = newUnit.id;
      }
    }

    // 1. Fetch current max version for this unit
    const { data: existingVersions } = await admin
      .from('curriculum_document_versions')
      .select('version_number')
      .eq('unit_id', targetUnitId)
      .eq('document_type', 'course_outline')
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number ?? 0) + 1;

    // 2. Mark previous versions as superseded
    await admin
      .from('curriculum_document_versions')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .eq('unit_id', targetUnitId)
      .eq('document_type', 'course_outline')
      .eq('status', 'active');

    // 3. Format topics into authoritative content structure
    const formattedContent = item.topics.map((t, idx) => ({
      sequence: t.sequence || (idx + 1),
      topic: t.topic.trim(),
      coverage: t.coverage.trim(),
      hours: t.hours,
      learningOutcomes: t.learningOutcomes?.trim() || '',
      activities: t.activities?.trim() || '',
      assessment: t.assessment?.trim() || '',
      resources: t.resources?.trim() || '',
    }));

    const documentPayload = {
      schemaVersion: 1,
      unit: {
        unitId: targetUnitId,
        unitCode: item.matchedUnitCode || item.unitCode.trim().toUpperCase(),
        unitName: item.matchedUnitName || item.unitName.trim(),
        unitDescription: item.unitDescription?.trim() || '',
        coreLearningOutcomes: item.coreLearningOutcomes?.trim() || '',
        teachingLearningApproaches:
          item.teachingLearningApproaches?.trim() ||
          'Interactive lectures, guided class discussions, practical demonstrations.',
        assessmentApproaches:
          item.assessmentApproaches?.trim() ||
          'Continuous Assessment Tests (CATs) · Final Summative Examination',
        referencesResources: item.references?.trim() || '',
      },
      content: formattedContent,
      source: {
        engineVersion: 5,
        fileName: sourceFileName || 'Bulk Upload',
        importedAt: new Date().toISOString(),
      },
    };

    // 4. Insert active version
    const { error: insertError } = await admin
      .from('curriculum_document_versions')
      .insert({
        department_id: targetDepartmentId,
        unit_id: targetUnitId,
        document_type: 'course_outline',
        version_number: nextVersion,
        status: 'active',
        source_type: 'admin_import',
        source_file_name: sourceFileName || 'Bulk Upload',
        created_by: profile.id,
        payload: documentPayload,
      });

    if (insertError) {
      console.error(`Failed to insert curriculum version for ${item.unitCode}:`, insertError);
      continue;
    }

    // 5. Update dynamic in-memory registry for instant response
    const codeKey = normalizeUnitCodeKey(item.unitCode);
    TVET_CURRICULUM_REGISTRY[`${codeKey}:course_outline`] = {
      unitCode: item.matchedUnitCode || item.unitCode.trim().toUpperCase(),
      unitName: item.matchedUnitName || item.unitName.trim(),
      unitDescription: item.unitDescription,
      overallCompetency: item.coreLearningOutcomes,
      learningOutcomes: item.coreLearningOutcomes ? [item.coreLearningOutcomes] : [],
      weeklySchedule: formattedContent.map((t) => ({
        weekNumber: t.sequence,
        topicTitle: t.topic,
        subTopics: t.coverage.split(/\s*[·;]\s*/).filter(Boolean),
        hours: t.hours,
        resourcesAndReferences: t.resources,
      })),
      references: item.references ? [item.references] : [],
      isAvailable: true,
    };

    committedCount++;
  }

  // 6. Revalidate application paths
  revalidatePath('/teaching-documents');
  revalidatePath('/teaching-documents/curriculum');
  revalidatePath('/staff/documents');
  revalidatePath('/staff/units/[allocationId]/documents', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');

  return {
    success: true,
    count: committedCount,
    message: `Successfully uploaded and published ${committedCount} authoritative course outline${committedCount === 1 ? '' : 's'}!`,
  };
}
