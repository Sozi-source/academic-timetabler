import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TeachingDocumentType,
} from './domain';
import type {
  TeachingDocumentRecord,
  TeachingDocumentTemplateSummary,
} from './types';

interface TemplateRow {
  id: string;
  document_type: TeachingDocumentType;
  name: string;
  version_number:
    | number
    | string;
  status:
    | 'draft'
    | 'active'
    | 'retired';
  storage_bucket: string;
  storage_path:
    | string
    | null;
  original_filename:
    | string
    | null;
  mime_type:
    | string
    | null;
  file_size_bytes:
    | number
    | string
    | null;
  sha256:
    | string
    | null;
  notes:
    | string
    | null;
  activated_at:
    | string
    | null;
  retired_at:
    | string
    | null;
  uploaded_at:
    | string
    | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  allocation_id: string;
  document_type: TeachingDocumentType;
  template_id: string;
  version_number:
    | number
    | string;
  status:
    | 'draft'
    | 'generated'
    | 'submitted'
    | 'approved'
    | 'archived';
  storage_bucket: string;
  storage_path:
    | string
    | null;
  original_filename:
    | string
    | null;
  mime_type:
    | string
    | null;
  file_size_bytes:
    | number
    | string
    | null;
  sha256:
    | string
    | null;
  updated_at: string;
}

async function untypedClient():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as
    SupabaseClient;
}

function numberOrNull(
  value:
    | number
    | string
    | null,
): number | null {
  if (
    value ===
    null
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function mapTemplate(
  row: TemplateRow,
): TeachingDocumentTemplateSummary {
  return {
    id:
      row.id,
    documentType:
      row.document_type,
    name:
      row.name,
    versionNumber:
      Number(
        row.version_number,
      ),
    status:
      row.status,
    storageBucket:
      row.storage_bucket,
    storagePath:
      row.storage_path,
    originalFilename:
      row.original_filename,
    mimeType:
      row.mime_type,
    fileSizeBytes:
      numberOrNull(
        row.file_size_bytes,
      ),
    sha256:
      row.sha256,
    notes:
      row.notes,
    activatedAt:
      row.activated_at,
    retiredAt:
      row.retired_at,
    uploadedAt:
      row.uploaded_at,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
  };
}

function mapDocument(
  row: DocumentRow,
): TeachingDocumentRecord {
  return {
    id:
      row.id,
    allocationId:
      row.allocation_id,
    documentType:
      row.document_type,
    templateId:
      row.template_id,
    versionNumber:
      Number(
        row.version_number,
      ),
    status:
      row.status,
    storageBucket:
      row.storage_bucket,
    storagePath:
      row.storage_path,
    originalFilename:
      row.original_filename,
    mimeType:
      row.mime_type,
    fileSizeBytes:
      numberOrNull(
        row.file_size_bytes,
      ),
    sha256:
      row.sha256,
    updatedAt:
      row.updated_at,
  };
}

export async function getTeachingDocumentTemplates():
Promise<TeachingDocumentTemplateSummary[]> {
  const supabase =
    await untypedClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      'teaching_document_templates',
    )
    .select(
      `
        id,
        document_type,
        name,
        version_number,
        status,
        storage_bucket,
        storage_path,
        original_filename,
        mime_type,
        file_size_bytes,
        sha256,
        notes,
        activated_at,
        retired_at,
        uploaded_at,
        created_at,
        updated_at
      `,
    )
    .order(
      'document_type',
      {
        ascending:
          true,
      },
    )
    .order(
      'version_number',
      {
        ascending:
          false,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load teaching-document templates: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as TemplateRow[]
  ).map(
    mapTemplate,
  );
}

export async function getActiveTeachingDocumentTemplates():
Promise<TeachingDocumentTemplateSummary[]> {
  const templates =
    await getTeachingDocumentTemplates();

  return templates.filter(
    (template) =>
      template.status ===
      'active',
  );
}

export async function getTeachingDocumentsByAllocationIds(
  allocationIds: string[],
): Promise<TeachingDocumentRecord[]> {
  if (
    allocationIds.length ===
    0
  ) {
    return [];
  }

  const supabase =
    await untypedClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      'teaching_documents',
    )
    .select(
      `
        id,
        allocation_id,
        document_type,
        template_id,
        version_number,
        status,
        storage_bucket,
        storage_path,
        original_filename,
        mime_type,
        file_size_bytes,
        sha256,
        updated_at
      `,
    )
    .in(
      'allocation_id',
      allocationIds,
    )
    .order(
      'version_number',
      {
        ascending:
          false,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load teaching documents: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as DocumentRow[]
  ).map(
    mapDocument,
  );
}

export async function getTeachingDocumentAdminCounts() {
  const supabase =
    await untypedClient();

  const [
    templateResult,
    documentResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'teaching_document_templates',
        )
        .select(
          'id',
          {
            count:
              'exact',
            head:
              true,
          },
        )
        .eq(
          'status',
          'active',
        ),

      supabase
        .from(
          'teaching_documents',
        )
        .select(
          'id',
          {
            count:
              'exact',
            head:
              true,
          },
        ),
    ]);

  const error =
    templateResult.error ??
    documentResult.error;

  if (error) {
    throw new Error(
      `Unable to load teaching-document counts: ${error.message}`,
    );
  }

  return {
    activeTemplates:
      templateResult.count ??
      0,
    documents:
      documentResult.count ??
      0,
  };
}
