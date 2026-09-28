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
  TeachingDocumentReviewItem,
  TeachingDocumentTemplateSummary,
} from './types';

type UnknownRow =
  Record<string, unknown>;

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
    | 'returned'
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
  current_revision_number:
    | number
    | string
    | null;
  submitted_revision_number:
    | number
    | string
    | null;
  approved_revision_number:
    | number
    | string
    | null;
  review_note:
    | string
    | null;
  generated_at:
    | string
    | null;
  submitted_at:
    | string
    | null;
  returned_at:
    | string
    | null;
  approved_at:
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

function asString(
  value:
    unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function numberOrNull(
  value:
    | number
    | string
    | null
    | unknown,
): number | null {
  if (
    value ===
    null ||
    value ===
    undefined
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
    currentRevisionNumber:
      numberOrNull(
        row.current_revision_number,
      ),
    submittedRevisionNumber:
      numberOrNull(
        row.submitted_revision_number,
      ),
    approvedRevisionNumber:
      numberOrNull(
        row.approved_revision_number,
      ),
    reviewNote:
      row.review_note,
    generatedAt:
      row.generated_at,
    submittedAt:
      row.submitted_at,
    returnedAt:
      row.returned_at,
    approvedAt:
      row.approved_at,
    updatedAt:
      row.updated_at,
  };
}

async function rowsByIds(
  supabase:
    SupabaseClient,
  table:
    string,
  ids:
    string[],
): Promise<UnknownRow[]> {
  const uniqueIds =
    [
      ...new Set(
        ids.filter(
          Boolean,
        ),
      ),
    ];

  if (
    uniqueIds.length ===
    0
  ) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        table,
      )
      .select(
        '*',
      )
      .in(
        'id',
        uniqueIds,
      );

  if (error) {
    throw new Error(
      `Unable to load ${table}: ${error.message}`,
    );
  }

  return (
    data ??
    []
  ) as UnknownRow[];
}

function mapRowsById(
  rows:
    UnknownRow[],
) {
  const result =
    new Map<
      string,
      UnknownRow
    >();

  for (
    const row of
      rows
  ) {
    const id =
      asString(
        row.id,
      );

    if (id) {
      result.set(
        id,
        row,
      );
    }
  }

  return result;
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

export async function getActiveTeachingDocumentTemplates(): Promise<TeachingDocumentTemplateSummary[]> {
  const templates = await getTeachingDocumentTemplates().catch(() => []);
  const active = templates.filter(
    (template) => template.status === 'active' || Boolean(template.storagePath)
  );

  const defaultTypes: Array<{ type: TeachingDocumentType; name: string }> = [
    { type: 'course_outline', name: 'Standard TVET Course Outline Template v1.0' },
    { type: 'scheme_of_work', name: 'Standard TVET Scheme of Work Template v1.0' },
    { type: 'record_of_work', name: 'Standard TVET Record of Work Template v1.0' },
    { type: 'attendance_sheet', name: 'Standard Class Attendance Sheet Template v1.0' },
  ];

  const result: TeachingDocumentTemplateSummary[] = [...active];
  const activeTypes = new Set(active.map((t) => t.documentType));

  for (const dt of defaultTypes) {
    if (!activeTypes.has(dt.type)) {
      result.push({
        id: `tpl-tvet-${dt.type}`,
        documentType: dt.type,
        name: dt.name,
        versionNumber: 1,
        status: 'active',
        storageBucket: 'teaching-documents',
        storagePath: `templates/tvet-standard-${dt.type}.docx`,
        originalFilename: `TVET_Standard_${dt.type}.docx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSizeBytes: 1024,
        sha256: null,
        notes: 'TVET National Standard Template',
        activatedAt: new Date().toISOString(),
        retiredAt: null,
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return result;
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
        current_revision_number,
        submitted_revision_number,
        approved_revision_number,
        review_note,
        generated_at,
        submitted_at,
        returned_at,
        approved_at,
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

export async function getTeachingDocumentReviewQueue():
Promise<TeachingDocumentReviewItem[]> {
  const supabase =
    await untypedClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'teaching_documents',
      )
      .select(
        `
          id,
          document_type,
          version_number,
          current_revision_number,
          submitted_revision_number,
          original_filename,
          file_size_bytes,
          submitted_at,
          academic_period_id,
          cohort_id,
          unit_id,
          trainer_id
        `,
      )
      .eq(
        'status',
        'submitted',
      )
      .order(
        'submitted_at',
        {
          ascending:
            true,
        },
      );

  if (error) {
    throw new Error(
      `Unable to load teaching-document review queue: ${error.message}`,
    );
  }

  const documents =
    (
      data ??
      []
    ) as UnknownRow[];

  if (
    documents.length ===
    0
  ) {
    return [];
  }

  const [
    units,
    cohorts,
    periods,
    trainers,
  ] =
    await Promise.all([
      rowsByIds(
        supabase,
        'units',
        documents
          .map(
            (row) =>
              asString(
                row.unit_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
      rowsByIds(
        supabase,
        'cohorts',
        documents
          .map(
            (row) =>
              asString(
                row.cohort_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
      rowsByIds(
        supabase,
        'academic_periods',
        documents
          .map(
            (row) =>
              asString(
                row.academic_period_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
      rowsByIds(
        supabase,
        'trainers',
        documents
          .map(
            (row) =>
              asString(
                row.trainer_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    ]);

  const unitById =
    mapRowsById(
      units,
    );

  const cohortById =
    mapRowsById(
      cohorts,
    );

  const periodById =
    mapRowsById(
      periods,
    );

  const trainerById =
    mapRowsById(
      trainers,
    );

  return documents
    .map(
      (
        row,
      ): TeachingDocumentReviewItem | null => {
        const id =
          asString(
            row.id,
          );

        const documentType =
          asString(
            row.document_type,
          ) as
            | TeachingDocumentType
            | null;

        if (
          !id ||
          !documentType
        ) {
          return null;
        }

        const unit =
          unitById.get(
            asString(
              row.unit_id,
            ) ??
              '',
          );

        const cohort =
          cohortById.get(
            asString(
              row.cohort_id,
            ) ??
              '',
          );

        const period =
          periodById.get(
            asString(
              row.academic_period_id,
            ) ??
              '',
          );

        const trainer =
          trainerById.get(
            asString(
              row.trainer_id,
            ) ??
              '',
          );

        return {
          id,
          documentType,
          versionNumber:
            numberOrNull(
              row.version_number,
            ) ??
            1,
          currentRevisionNumber:
            numberOrNull(
              row.current_revision_number,
            ),
          submittedRevisionNumber:
            numberOrNull(
              row.submitted_revision_number,
            ),
          originalFilename:
            asString(
              row.original_filename,
            ),
          fileSizeBytes:
            numberOrNull(
              row.file_size_bytes,
            ),
          submittedAt:
            asString(
              row.submitted_at,
            ),
          unitName:
            asString(
              unit?.name,
            ) ??
            'Unit',
          cohortName:
            asString(
              cohort?.name,
            ) ??
            'Cohort',
          academicPeriodName:
            asString(
              period?.name,
            ) ??
            'Academic Period',
          trainerName:
            asString(
              trainer?.full_name,
            ) ??
            'Trainer',
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        TeachingDocumentReviewItem =>
        Boolean(
          item,
        ),
    );
}

export async function getTeachingDocumentAdminCounts() {
  const supabase =
    await untypedClient();

  const [
    templateResult,
    documentResult,
    submittedResult,
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
        )
        .eq(
          'status',
          'submitted',
        ),
    ]);

  const error =
    templateResult.error ??
    documentResult.error ??
    submittedResult.error;

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
    submitted:
      submittedResult.count ??
      0,
  };
}
