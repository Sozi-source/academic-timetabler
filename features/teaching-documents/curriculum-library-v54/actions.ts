'use server';

import {
  revalidatePath,
} from 'next/cache';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

async function managedDocument(
  documentId: string,
) {
  const profile =
    await requireHodAccess();

  if (
    !profile.activeDepartmentId
  ) {
    throw new Error(
      'No active department selected.',
    );
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
      'id,department_id,unit_id,document_type,status',
    )
    .eq('id', documentId)
    .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ??
        'Curriculum document was not found.',
    );
  }

  if (
    String(
      data.department_id,
    ) !==
    String(
      profile.activeDepartmentId,
    )
  ) {
    throw new Error(
      'This curriculum document does not belong to the active department.',
    );
  }

  return {
    supabase,
    document: data,
  };
}

function revalidateCurriculum(
  unitId?: string,
  documentType?: string,
) {
  revalidatePath(
    '/teaching-documents',
  );
  revalidatePath(
    '/teaching-documents/curriculum',
  );
  revalidatePath(
    '/staff/teaching-documents',
  );

  if (
    unitId &&
    documentType
  ) {
    revalidatePath(
      `/teaching-documents/curriculum/library/${unitId}/${documentType}`,
    );
  }
}

export async function retireCurriculumDocumentV54(
  formData: FormData,
) {
  const documentId =
    String(
      formData.get(
        'documentId',
      ) ?? '',
    ).trim();

  if (!documentId) {
    throw new Error(
      'Missing curriculum document.',
    );
  }

  const {
    supabase,
    document,
  } =
    await managedDocument(
      documentId,
    );

  const {
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .update({
      status: 'retired',
      retired_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidateCurriculum(
    String(
      document.unit_id,
    ),
    String(
      document.document_type,
    ),
  );
}

export async function activateCurriculumDocumentV54(
  formData: FormData,
) {
  const documentId =
    String(
      formData.get(
        'documentId',
      ) ?? '',
    ).trim();

  if (!documentId) {
    throw new Error(
      'Missing curriculum document.',
    );
  }

  const {
    supabase,
    document,
  } =
    await managedDocument(
      documentId,
    );

  const now =
    new Date().toISOString();

  const {
    error: supersedeError,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .update({
      status:
        'superseded',
      superseded_at:
        now,
      updated_at:
        now,
    })
    .eq(
      'unit_id',
      document.unit_id,
    )
    .eq(
      'document_type',
      document.document_type,
    )
    .eq(
      'status',
      'active',
    )
    .neq(
      'id',
      documentId,
    );

  if (
    supersedeError
  ) {
    throw new Error(
      supersedeError.message,
    );
  }

  const {
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .update({
      status: 'active',
      retired_at: null,
      superseded_at: null,
      updated_at: now,
    })
    .eq(
      'id',
      documentId,
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidateCurriculum(
    String(
      document.unit_id,
    ),
    String(
      document.document_type,
    ),
  );
}

export async function deleteCurriculumDocumentV54(
  formData: FormData,
) {
  const documentId =
    String(
      formData.get(
        'documentId',
      ) ?? '',
    ).trim();

  if (!documentId) {
    throw new Error(
      'Missing curriculum document.',
    );
  }

  const {
    supabase,
    document,
  } =
    await managedDocument(
      documentId,
    );

  const {
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .delete()
    .eq(
      'id',
      documentId,
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidateCurriculum(
    String(
      document.unit_id,
    ),
    String(
      document.document_type,
    ),
  );
}

export async function clearAllGeneratedCurriculumDocumentsAction() {
  await requireHodAccess();
  const supabase = await createClient();

  await Promise.allSettled([
    (supabase as any).from('curriculum_document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('curriculum_content_import_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('trainer_teaching_document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('teaching_documents').delete().in('document_type', ['course_outline', 'scheme_of_work', 'lesson_plan']),
    (supabase as any).from('curriculum_unit_mappings').delete().neq('unit_id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('curriculum_weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('curriculum_learning_outcomes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('curriculum_references').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    (supabase as any).from('curriculum_families').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]);

  revalidatePath('/teaching-documents/curriculum');
  revalidatePath('/teaching-documents');
  revalidatePath('/staff/documents');
  revalidatePath('/staff/units/[allocationId]/documents', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
}

