import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  teachingDocumentKinds,
  type TeachingDocumentType,
} from '@/features/teaching-documents/domain';
import {
  createClient,
} from '@/lib/supabase/server';

interface RequestPayload {
  allocationId?: unknown;
  documentType?: unknown;
}

function isDocumentType(
  value: unknown,
): value is TeachingDocumentType {
  return (
    typeof value ===
      'string' &&
    teachingDocumentKinds.some(
      (item) =>
        item.value ===
        value,
    )
  );
}

export async function POST(
  request: Request,
) {
  await requireTrainerAccess();

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as RequestPayload | null;

  if (
    !payload ||
    typeof payload.allocationId !==
      'string' ||
    !isDocumentType(
      payload.documentType,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'A valid Teaching Allocation and document type are required.',
      },
      {
        status:
          400,
      },
    );
  }

  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    data,
    error,
  } = await supabase.rpc(
    'create_teaching_document_record',
    {
      target_allocation_id:
        payload.allocationId,
      target_document_type:
        payload.documentType,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message:
          error.message,
      },
      {
        status:
          error.code ===
          '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    document:
      data,
  });
}
