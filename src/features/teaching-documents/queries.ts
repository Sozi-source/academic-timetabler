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
  storage_path:
    | string
    | null;
  original_filename:
    | string
    | null;
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
  storage_path:
    | string
    | null;
  original_filename:
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
    storagePath:
      row.storage_path,
    originalFilename:
      row.original_filename,
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
    storagePath:
      row.storage_path,
    originalFilename:
      row.original_filename,
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
        storage_path,
        original_filename,
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
        storage_path,
        original_filename,
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
