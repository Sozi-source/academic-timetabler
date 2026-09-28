'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDocumentHeaderContext } from './record-of-work-actions';
import { getApprovedCurriculumForUnitCode } from './curriculum-content/queries';
import { getAssessmentMilestones } from './assessment-milestones';
import {
  generateTVETCourseOutline,
  generateTVETSchemeOfWork,
} from './tvet-standards';
import { buildTVETDocumentDocx } from './export-docx';
import {
  teachingDocumentRevisionStoragePath,
  teachingFileSha256,
} from './storage';
import {
  teachingDocumentStorageBucket,
  type TeachingDocumentStatus,
  type TeachingDocumentType,
} from './domain';

export interface TeachingDocumentStatusInfo {
  id: string;
  allocationId: string;
  documentType: TeachingDocumentType;
  status: TeachingDocumentStatus;
  versionNumber: number;
  currentRevisionNumber: number | null;
  submittedRevisionNumber: number | null;
  approvedRevisionNumber: number | null;
  reviewNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  updatedAt: string;
}

const DEFAULT_TEMPLATE_IDS: Record<string, string> = {
  course_outline: '34664748-4a24-4c24-93f2-69e0827a5c76',
  scheme_of_work: '205136bb-96e3-4a9e-8c9b-86f173726892',
  record_of_work: 'f80297f6-9740-4a32-8ba3-0c0f16161989',
};

/**
 * Loads the active submission and review status for a single document allocation.
 */
export async function getTeachingDocumentAllocationStatus(
  allocationId: string,
  documentType: TeachingDocumentType,
): Promise<TeachingDocumentStatusInfo | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('teaching_documents')
    .select(
      `
      id,
      allocation_id,
      document_type,
      status,
      version_number,
      current_revision_number,
      submitted_revision_number,
      approved_revision_number,
      review_note,
      submitted_at,
      approved_at,
      returned_at,
      updated_at
    `,
    )
    .eq('allocation_id', allocationId)
    .eq('document_type', documentType)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    allocationId: data.allocation_id,
    documentType: data.document_type as TeachingDocumentType,
    status: data.status as TeachingDocumentStatus,
    versionNumber: Number(data.version_number),
    currentRevisionNumber: data.current_revision_number
      ? Number(data.current_revision_number)
      : null,
    submittedRevisionNumber: data.submitted_revision_number
      ? Number(data.submitted_revision_number)
      : null,
    approvedRevisionNumber: data.approved_revision_number
      ? Number(data.approved_revision_number)
      : null,
    reviewNote: data.review_note ?? null,
    submittedAt: data.submitted_at ?? null,
    approvedAt: data.approved_at ?? null,
    returnedAt: data.returned_at ?? null,
    updatedAt: data.updated_at,
  };
}

/**
 * Loads statuses of all teaching documents for a specific allocation.
 */
export async function getAllTeachingDocumentStatusesForAllocation(
  allocationId: string,
): Promise<Record<string, TeachingDocumentStatusInfo>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('teaching_documents')
    .select(
      `
      id,
      allocation_id,
      document_type,
      status,
      version_number,
      current_revision_number,
      submitted_revision_number,
      approved_revision_number,
      review_note,
      submitted_at,
      approved_at,
      returned_at,
      updated_at
    `,
    )
    .eq('allocation_id', allocationId)
    .order('version_number', { ascending: false });

  if (error || !data) {
    return {};
  }

  const result: Record<string, TeachingDocumentStatusInfo> = {};
  for (const row of data) {
    const docType = row.document_type as TeachingDocumentType;
    if (!result[docType]) {
      result[docType] = {
        id: row.id,
        allocationId: row.allocation_id,
        documentType: docType,
        status: row.status as TeachingDocumentStatus,
        versionNumber: Number(row.version_number),
        currentRevisionNumber: row.current_revision_number
          ? Number(row.current_revision_number)
          : null,
        submittedRevisionNumber: row.submitted_revision_number
          ? Number(row.submitted_revision_number)
          : null,
        approvedRevisionNumber: row.approved_revision_number
          ? Number(row.approved_revision_number)
          : null,
        reviewNote: row.review_note ?? null,
        submittedAt: row.submitted_at ?? null,
        approvedAt: row.approved_at ?? null,
        returnedAt: row.returned_at ?? null,
        updatedAt: row.updated_at,
      };
    }
  }

  return result;
}

/**
 * Trainer Confirm & Submit Action:
 * Compiles the verified TVET document, uploads official .docx to private storage,
 * registers a revision, and submits it into the HOD review queue.
 */
export async function submitTrainerTeachingDocumentAction({
  allocationId,
  documentType,
}: {
  allocationId: string;
  documentType: 'course_outline' | 'scheme_of_work';
}): Promise<{
  success: boolean;
  message: string;
  statusInfo?: TeachingDocumentStatusInfo;
}> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  // 1. Verify allocation
  const { data: allocation, error: allocError } = await admin
    .from('teaching_allocations')
    .select('id, academic_period_id, cohort_id, unit_id, trainer_id')
    .eq('id', allocationId)
    .maybeSingle();

  if (allocError || !allocation) {
    throw new Error('Teaching allocation not found.');
  }

  // If user is a trainer, ensure they are assigned to this allocation
  if (profile.role === 'trainer') {
    const { data: trainerRec } = await admin
      .from('trainers')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (!trainerRec || allocation.trainer_id !== trainerRec.id) {
      throw new Error(
        'Access denied: You are not assigned to this unit allocation.',
      );
    }
  }

  // 2. Load context
  const header = await getDocumentHeaderContext(allocationId);
  if (!header) {
    throw new Error(
      'Unable to resolve document header context for this allocation.',
    );
  }

  // 3. Load approved curriculum syllabus & assessment schedule milestones
  const [curriculum, milestones] = await Promise.all([
    getApprovedCurriculumForUnitCode(
      header.unitCode,
      header.unitName,
      documentType,
    ),
    getAssessmentMilestones(header.academicPeriodId ?? undefined),
  ]);

  if (!curriculum || curriculum.isAvailable === false) {
    throw new Error(
      curriculum?.notReadyMessage ||
        'Curriculum syllabus content is not available or verified for this unit. Please upload syllabus or contact the department.',
    );
  }

  // 4. Generate the official TVET Word (.docx) buffer
  let docxBuffer: Buffer;
  if (documentType === 'course_outline') {
    const courseOutline = generateTVETCourseOutline(
      header,
      curriculum,
      milestones,
    );
    if (
      !courseOutline.weeklySchedule ||
      courseOutline.weeklySchedule.length === 0
    ) {
      throw new Error('Course outline weekly schedule is incomplete.');
    }
    docxBuffer = await buildTVETDocumentDocx('course_outline', {
      courseOutline,
    });
  } else {
    const schemeOfWork = generateTVETSchemeOfWork(
      header,
      curriculum,
      milestones,
    );
    if (
      !schemeOfWork.plannedWeeks ||
      schemeOfWork.plannedWeeks.length === 0
    ) {
      throw new Error('Scheme of work weekly planned schedule is incomplete.');
    }
    docxBuffer = await buildTVETDocumentDocx('scheme_of_work', {
      schemeOfWork,
    });
  }

  const cleanUnitCode = header.unitCode
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename =
    documentType === 'course_outline'
      ? `${header.unitName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_Course_Outline.docx`
      : `${cleanUnitCode}_${documentType}.docx`;
  const mimeType =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const sha256Hex = teachingFileSha256(docxBuffer);

  // 5. Resolve active template ID
  const { data: templateRow } = await admin
    .from('teaching_document_templates')
    .select('id')
    .eq('document_type', documentType)
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const templateId =
    templateRow?.id ??
    DEFAULT_TEMPLATE_IDS[documentType] ??
    DEFAULT_TEMPLATE_IDS.course_outline;

  // 6. Check existing teaching_documents row
  const { data: existingDoc } = await admin
    .from('teaching_documents')
    .select('id, current_revision_number, version_number, status')
    .eq('allocation_id', allocationId)
    .eq('document_type', documentType)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId: string;
  let newRevisionNumber: number;

  if (existingDoc) {
    documentId = existingDoc.id;
    newRevisionNumber = (existingDoc.current_revision_number ?? 0) + 1;
    const storagePath = teachingDocumentRevisionStoragePath(
      documentId,
      filename,
    );

    // Upload to private storage bucket
    const { error: uploadError } = await admin.storage
      .from(teachingDocumentStorageBucket)
      .upload(storagePath, docxBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(
        `Failed to store document in private storage: ${uploadError.message}`,
      );
    }

    // Insert revision
    const { error: revError } = await admin
      .from('teaching_document_revisions')
      .insert({
        document_id: documentId,
        revision_number: newRevisionNumber,
        source: 'trainer_upload',
        storage_bucket: teachingDocumentStorageBucket,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: docxBuffer.byteLength,
        sha256: sha256Hex,
        created_by: profile.id,
      });

    if (revError) {
      throw new Error(`Failed to record revision: ${revError.message}`);
    }

    // Insert submission
    const { error: subError } = await admin
      .from('teaching_document_submissions')
      .insert({
        document_id: documentId,
        revision_number: newRevisionNumber,
        submitted_by: profile.id,
      });

    if (subError) {
      throw new Error(`Failed to record submission: ${subError.message}`);
    }

    // Update teaching_documents
    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from('teaching_documents')
      .update({
        status: 'approved',
        storage_bucket: teachingDocumentStorageBucket,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: docxBuffer.byteLength,
        sha256: sha256Hex,
        current_revision_number: newRevisionNumber,
        submitted_revision_number: newRevisionNumber,
        approved_revision_number: newRevisionNumber,
        submitted_at: nowIso,
        approved_at: nowIso,
        approved_by: profile.id,
        review_note: null,
        returned_at: null,
        returned_by: null,
        updated_at: nowIso,
        updated_by: profile.id,
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(
        `Failed to update document status: ${updateError.message}`,
      );
    }

    // Record approval in reviews table for audit trail
    await admin.from('teaching_document_reviews').insert({
      document_id: documentId,
      revision_number: newRevisionNumber,
      decision: 'approved',
      note: 'Confirmed by trainer and approved for QA download',
      reviewed_by: profile.id,
    });
  } else {
    documentId = randomUUID();
    newRevisionNumber = 1;
    const storagePath = teachingDocumentRevisionStoragePath(
      documentId,
      filename,
    );

    // Upload to private storage bucket
    const { error: uploadError } = await admin.storage
      .from(teachingDocumentStorageBucket)
      .upload(storagePath, docxBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(
        `Failed to store document in private storage: ${uploadError.message}`,
      );
    }

    const nowIso = new Date().toISOString();

    // Insert teaching_documents as approved
    const { error: insertError } = await admin
      .from('teaching_documents')
      .insert({
        id: documentId,
        allocation_id: allocationId,
        academic_period_id: allocation.academic_period_id,
        cohort_id: allocation.cohort_id,
        unit_id: allocation.unit_id,
        trainer_id: allocation.trainer_id,
        document_type: documentType,
        template_id: templateId,
        version_number: 1,
        status: 'approved',
        storage_bucket: teachingDocumentStorageBucket,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: docxBuffer.byteLength,
        sha256: sha256Hex,
        current_revision_number: 1,
        submitted_revision_number: 1,
        approved_revision_number: 1,
        submitted_at: nowIso,
        approved_at: nowIso,
        approved_by: profile.id,
        created_by: profile.id,
        updated_by: profile.id,
      });

    if (insertError) {
      throw new Error(
        `Failed to register teaching document: ${insertError.message}`,
      );
    }

    // Insert revision
    const { error: revError } = await admin
      .from('teaching_document_revisions')
      .insert({
        document_id: documentId,
        revision_number: 1,
        source: 'trainer_upload',
        storage_bucket: teachingDocumentStorageBucket,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: docxBuffer.byteLength,
        sha256: sha256Hex,
        created_by: profile.id,
      });

    if (revError) {
      throw new Error(`Failed to record revision: ${revError.message}`);
    }

    // Insert submission
    const { error: subError } = await admin
      .from('teaching_document_submissions')
      .insert({
        document_id: documentId,
        revision_number: 1,
        submitted_by: profile.id,
      });

    if (subError) {
      throw new Error(`Failed to record submission: ${subError.message}`);
    }

    // Record approval in reviews table for audit trail
    await admin.from('teaching_document_reviews').insert({
      document_id: documentId,
      revision_number: 1,
      decision: 'approved',
      note: 'Confirmed by trainer and approved for QA download',
      reviewed_by: profile.id,
    });
  }

  // 7. Revalidate Next.js cache paths
  revalidatePath(`/staff/units/${allocationId}/documents`);
  revalidatePath(`/staff/units/${allocationId}/documents/course-outline`);
  revalidatePath(`/staff/units/${allocationId}/documents/scheme-of-work`);
  revalidatePath('/teaching-documents/review');
  revalidatePath('/teaching-documents/qa-export');

  const nowIso = new Date().toISOString();
  const docTitle =
    documentType === 'course_outline' ? 'Course Outline' : 'Scheme of Work';

  return {
    success: true,
    message: `${docTitle} confirmed, approved, and ready for QA download.`,
    statusInfo: {
      id: documentId,
      allocationId,
      documentType,
      status: 'approved',
      versionNumber: existingDoc ? Number(existingDoc.version_number) : 1,
      currentRevisionNumber: newRevisionNumber,
      submittedRevisionNumber: newRevisionNumber,
      approvedRevisionNumber: newRevisionNumber,
      reviewNote: null,
      submittedAt: nowIso,
      approvedAt: nowIso,
      returnedAt: null,
      updatedAt: nowIso,
    },
  };
}
