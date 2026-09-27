'use server';

import { revalidatePath } from 'next/cache';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isCurriculumDocumentType,
  type CurriculumDocumentType,
} from './curriculum-document-types';
import { parseDocxSyllabus } from './curriculum-editor/docx-parser';
import { normalizeUnitCodeKey, TVET_CURRICULUM_REGISTRY } from './curriculum-registry';
import { stripTopicFigures } from './distribution-engine';
import { hasTopicCoverageContamination } from './topic-coverage-validation';

export interface IndividualTopicItem {
  sequence: number;
  topicTitle: string;
  subTopics: string;
  hours?: number;
  learningOutcomes?: string;
  activities?: string;
  resources?: string;
}

export interface IndividualCurriculumPayload {
  documentType?: CurriculumDocumentType;
  unitId?: string;
  unitCode: string;
  unitName: string;
  unitDescription: string;
  overallCompetencies: string;
  references: string;
  teachingLearningApproaches?: string;
  assessmentApproaches?: string;
  topics: IndividualTopicItem[];
}

export interface ParsedIndividualResult {
  ok: boolean;
  error?: string;
  fileName: string;
  fileType: 'docx' | 'xlsx';
  detectedDocumentType: CurriculumDocumentType;
  unitCode: string;
  unitName: string;
  unitDescription: string;
  overallCompetencies: string;
  references: string;
  topics: IndividualTopicItem[];
  issues: string[];
}

export async function parseIndividualCurriculumAction(
  formData: FormData,
): Promise<ParsedIndividualResult> {
  await requireTrainerAccess();

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return {
      ok: false,
      error: 'Please select a valid Word (.docx) or Excel (.xlsx) file.',
      fileName: '',
      fileType: 'docx',
      detectedDocumentType: 'course_outline',
      unitCode: '',
      unitName: '',
      unitDescription: '',
      overallCompetencies: '',
      references: '',
      topics: [],
      issues: ['No file provided.'],
    };
  }

  const fileName = file.name;
  const isDocx = fileName.toLowerCase().endsWith('.docx');
  const isXlsx = fileName.toLowerCase().endsWith('.xlsx');

  if (!isDocx && !isXlsx) {
    return {
      ok: false,
      error: 'Unsupported file format. Please upload a Word (.docx) or Excel (.xlsx) document.',
      fileName,
      fileType: 'docx',
      detectedDocumentType: 'course_outline',
      unitCode: '',
      unitName: '',
      unitDescription: '',
      overallCompetencies: '',
      references: '',
      topics: [],
      issues: ['File must be .docx or .xlsx'],
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedDocumentType: CurriculumDocumentType =
    /scheme|sow/i.test(fileName) ? 'scheme_of_work' : 'course_outline';

  if (isDocx) {
    try {
      const parsed = parseDocxSyllabus(buffer, fileName);

      if (parsed.topics.length === 0) {
        return {
          ok: false,
          error:
            'No topics or topical tables could be extracted from this Word document. Ensure it contains a schedule table or numbered topics.',
          fileName,
          fileType: 'docx',
          detectedDocumentType,
          unitCode: parsed.unitCode || '',
          unitName: parsed.unitName || '',
          unitDescription: parsed.unitDescription || '',
          overallCompetencies: parsed.overallCompetencies || '',
          references: parsed.references || '',
          topics: [],
          issues: ['Document contains no detectable topics.'],
        };
      }

      const issues: string[] = [];
      const topics: IndividualTopicItem[] = parsed.topics.map((t, idx) => ({
        sequence: idx + 1,
        topicTitle: stripTopicFigures(t.topicTitle),
        subTopics: t.subTopics,
      }));

      if (
        hasTopicCoverageContamination(
          topics.map((t) => ({ topic: t.topicTitle, coverage: t.subTopics })),
        )
      ) {
        issues.push(
          'Some topic titles appear to contain pasted subtopic paragraphs. Please review topic titles before publishing.',
        );
      }

      return {
        ok: true,
        fileName,
        fileType: 'docx',
        detectedDocumentType,
        unitCode: parsed.unitCode || '',
        unitName: parsed.unitName || '',
        unitDescription: parsed.unitDescription || '',
        overallCompetencies: parsed.overallCompetencies || '',
        references: parsed.references || '',
        topics,
        issues,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not parse Word document.',
        fileName,
        fileType: 'docx',
        detectedDocumentType,
        unitCode: '',
        unitName: '',
        unitDescription: '',
        overallCompetencies: '',
        references: '',
        topics: [],
        issues: ['Word parsing error.'],
      };
    }
  } else {
    // Excel file parsing
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );

      let unitCode = '';
      let unitName = '';
      let unitDescription = '';
      let overallCompetencies = '';
      let references = '';
      const topics: IndividualTopicItem[] = [];

      // Scan sheets
      workbook.eachSheet((sheet) => {
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const col1 = String(row.getCell(1).value || '').trim();
          const col2 = String(row.getCell(2).value || '').trim();
          const col3 = String(row.getCell(3).value || '').trim();

          const seq = parseInt(col1.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(seq) && col2) {
            topics.push({
              sequence: seq,
              topicTitle: stripTopicFigures(col2),
              subTopics: col3 || col2,
            });
          }

          if (!unitCode) {
            const codeMatch = (col1 + ' ' + col2).match(
              /\b([A-Z]{2,6})\s*([0-9]{3,4})\b/i,
            );
            if (codeMatch) {
              unitCode = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
            }
          }
        });
      });

      return {
        ok: true,
        fileName,
        fileType: 'xlsx',
        detectedDocumentType,
        unitCode,
        unitName,
        unitDescription,
        overallCompetencies,
        references,
        topics,
        issues: [],
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not parse Excel document.',
        fileName,
        fileType: 'xlsx',
        detectedDocumentType,
        unitCode: '',
        unitName: '',
        unitDescription: '',
        overallCompetencies: '',
        references: '',
        topics: [],
        issues: ['Excel parsing error.'],
      };
    }
  }
}

export interface PublishIndividualCurriculumResult {
  success: boolean;
  error?: string;
  documentId?: string;
  message?: string;
}

export async function publishIndividualCurriculumAction(
  payload: IndividualCurriculumPayload,
): Promise<PublishIndividualCurriculumResult> {
  const profile = await requireTrainerAccess();
  const documentType = payload.documentType ?? 'course_outline';

  // NOTE: every validation and DB-error branch below RETURNS a structured
  // { success: false, error } instead of throwing. A thrown error inside a
  // Server Action has its message redacted by Next.js in production
  // (replaced with the generic "An error occurred in the Server Components
  // render..." banner), so throwing here means the user never sees which of
  // these specific problems actually happened. Returning keeps the real
  // message intact all the way to the UI. Do not change these back to
  // `throw new Error(...)`.

  if (!profile.activeDepartmentId) {
    return {
      success: false,
      error: 'Select an active department before publishing curriculum documents.',
    };
  }

  if (!isCurriculumDocumentType(documentType)) {
    return {
      success: false,
      error: 'Select whether this document is a course outline or scheme of work.',
    };
  }

  if (!payload.unitCode?.trim()) {
    return { success: false, error: 'Please specify a unit code (e.g. DHN 2304).' };
  }

  if (!payload.topics || payload.topics.length === 0) {
    return { success: false, error: 'Please provide at least one topic for the syllabus.' };
  }

  const admin = createAdminClient();
  let targetUnitId = payload.unitId;

  try {
    // Resolve or create unit in units table
    if (targetUnitId) {
      const { data: selectedUnit } = await admin
        .from('units')
        .select('id')
        .eq('id', targetUnitId)
        .eq('department_id', profile.activeDepartmentId)
        .maybeSingle();

      if (!selectedUnit) {
        targetUnitId = undefined;
      }
    }

    if (!targetUnitId) {
      const { data: existingUnit } = await admin
        .from('units')
        .select('id')
        .ilike('code', payload.unitCode.trim())
        .eq('department_id', profile.activeDepartmentId)
        .maybeSingle();

      if (existingUnit) {
        targetUnitId = existingUnit.id;
      } else {
        const { data: newUnit, error: createUnitError } = await admin
          .from('units')
          .insert({
            code: payload.unitCode.trim().toUpperCase(),
            name: payload.unitName.trim() || payload.unitCode.trim(),
            department_id: profile.activeDepartmentId,
            is_active: true,
          })
          .select('id')
          .single();

        if (createUnitError) {
          return { success: false, error: `Failed to create unit: ${createUnitError.message}` };
        }
        targetUnitId = newUnit.id;
      }
    }

    // 1. Fetch current max version for this unit
    const { data: existingVersions } = await admin
      .from('curriculum_document_versions')
      .select('version_number')
      .eq('department_id', profile.activeDepartmentId)
      .eq('unit_id', targetUnitId)
      .eq('document_type', documentType)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number ?? 0) + 1;

    // 2. Mark previous versions as superseded
    await admin
      .from('curriculum_document_versions')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .eq('department_id', profile.activeDepartmentId)
      .eq('unit_id', targetUnitId)
      .eq('document_type', documentType)
      .eq('status', 'active');

    // 3. Construct structured payload
    const formattedContent = payload.topics.map((t, idx) => ({
      sequence: t.sequence || idx + 1,
      topic: t.topicTitle.trim(),
      coverage: t.subTopics.trim(),
      hours: t.hours,
      learningOutcomes: t.learningOutcomes?.trim() || '',
      activities: t.activities?.trim() || '',
      resources: t.resources?.trim() || '',
    }));

    const documentPayload = {
      schemaVersion: 1,
      unit: {
        unitId: targetUnitId,
        unitCode: payload.unitCode.trim().toUpperCase(),
        unitName: payload.unitName.trim() || payload.unitCode.trim(),
        unitDescription: payload.unitDescription?.trim() || '',
        coreLearningOutcomes: payload.overallCompetencies?.trim() || '',
        teachingLearningApproaches:
          payload.teachingLearningApproaches?.trim() ||
          'Interactive lectures, guided class discussions, practical demonstrations.',
        assessmentApproaches:
          payload.assessmentApproaches?.trim() ||
          'Continuous Assessment Tests (CATs) · Final Summative Examination',
        referencesResources: payload.references?.trim() || '',
      },
      content: formattedContent,
      source: {
        engineVersion: 5,
        fileName: 'Individual Upload',
        importedAt: new Date().toISOString(),
      },
    };

    // 4. Insert active version
    // IMPORTANT: `curriculum_document_versions.source_type` has a DB check
    // constraint that only allows 'admin_import' | 'legacy_import' |
    // 'trainer_upload'. This screen is a trainer uploading a single
    // document, so 'trainer_upload' is both allowed AND the semantically
    // correct value. Using 'individual_upload' here (the previous value)
    // violates the constraint and fails EVERY insert -- that was the actual
    // cause of the generic "Server Components render" error. Do not change
    // this back without also migrating the DB constraint.
    const { data: newDoc, error: insertError } = await admin
      .from('curriculum_document_versions')
      .insert({
        department_id: profile.activeDepartmentId,
        unit_id: targetUnitId,
        document_type: documentType,
        version_number: nextVersion,
        status: 'active',
        source_type: 'trainer_upload',
        source_file_name: 'Individual Upload',
        created_by: profile.id,
        payload: documentPayload,
      })
      .select('id')
      .single();

    if (insertError) {
      return { success: false, error: `Failed to save curriculum: ${insertError.message}` };
    }

    // 5. Update dynamic registry
    const codeKey = normalizeUnitCodeKey(payload.unitCode);
    TVET_CURRICULUM_REGISTRY[`${codeKey}:${documentType}`] = {
      unitCode: payload.unitCode.trim().toUpperCase(),
      unitName: payload.unitName.trim() || payload.unitCode.trim(),
      unitDescription: payload.unitDescription,
      overallCompetency: payload.overallCompetencies,
      learningOutcomes: payload.overallCompetencies
        ? [payload.overallCompetencies]
        : [],
      weeklySchedule: formattedContent.map((t) => ({
        weekNumber: t.sequence,
        topicTitle: t.topic,
        subTopics: t.coverage.split(/\s*[·;]\s*/).filter(Boolean),
        hours: t.hours,
        resourcesAndReferences: t.resources,
      })),
      references: payload.references ? [payload.references] : [],
      isAvailable: true,
    };

    // 6. Revalidate application paths
    revalidatePath('/teaching-documents');
    revalidatePath('/teaching-documents/curriculum');
    revalidatePath('/teaching-documents/curriculum/individual-upload');
    revalidatePath('/staff/documents');
    revalidatePath('/staff/units/[allocationId]/documents', 'page');
    revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
    revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');

    return {
      success: true,
      documentId: newDoc?.id,
      message: `${documentType === 'scheme_of_work' ? 'Scheme of Work' : 'Course Outline'} for ${payload.unitCode} published successfully!`,
    };
  } catch (err: unknown) {
    // Catch-all safety net: any unexpected exception still reaches the
    // client as its real message instead of Next.js's redacted banner.
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Unexpected error while publishing curriculum document.',
    };
  }
}

// Backward-compatibility aliases
export async function saveOnlineCurriculumAction(
  payload: IndividualCurriculumPayload,
): Promise<PublishIndividualCurriculumResult> {
  return publishIndividualCurriculumAction(payload);
}
