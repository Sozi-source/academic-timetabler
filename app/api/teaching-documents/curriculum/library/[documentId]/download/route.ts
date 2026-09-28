import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  buildCurriculumLibraryWorkbookV54,
} from '@/features/teaching-documents/curriculum-library-v54/workbook';
import {
  createClient,
} from '@/lib/supabase/server';

function safeFileName(
  value: string,
) {
  return value
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '_',
    )
    .replace(
      /_+/g,
      '_',
    )
    .replace(
      /^_|_$/g,
      '',
    );
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      documentId: string;
    }>;
  },
) {
  const profile =
    await requireHodAccess();

  if (
    !profile.activeDepartmentId
  ) {
    return new Response(
      'No active department selected.',
      {
        status: 400,
      },
    );
  }

  const {
    documentId,
  } = await params;

  const supabase =
    await createClient();

  const {
    data: document,
    error,
  } = await (supabase as any)
    .from(
      'curriculum_document_versions',
    )
    .select(
      'id,department_id,unit_id,document_type,version_number,payload',
    )
    .eq(
      'id',
      documentId,
    )
    .single();

  if (
    error ||
    !document
  ) {
    return new Response(
      'Curriculum document not found.',
      {
        status: 404,
      },
    );
  }

  if (
    String(
      document.department_id,
    ) !==
    String(
      profile.activeDepartmentId,
    )
  ) {
    return new Response(
      'Forbidden',
      {
        status: 403,
      },
    );
  }

  const {
    data: unit,
  } = await (supabase as any)
    .from('units')
    .select('code,name')
    .eq(
      'id',
      document.unit_id,
    )
    .single();

  const buffer =
    await buildCurriculumLibraryWorkbookV54(
      {
        documentType:
          document.document_type,
        versionNumber:
          Number(
            document.version_number,
          ),
        payload:
          document.payload,
      },
    );

  const label =
    document.document_type ===
    'course_outline'
      ? 'Course_Outline'
      : 'Scheme_of_Work';

  const fileName =
    `${safeFileName(
      String(
        unit?.code ??
          'Unit',
      ),
    )}_${label}_v${document.version_number}.xlsx`;

  return new Response(
    new Uint8Array(
      buffer,
    ),
    {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          `attachment; filename="${fileName}"`,
        'Cache-Control':
          'no-store',
      },
    },
  );
}
