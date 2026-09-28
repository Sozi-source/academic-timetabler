import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import type {
  TeachingDocumentReviewDecision,
} from '@/features/teaching-documents/domain';
import {
  createClient,
} from '@/lib/supabase/server';

interface ReviewPayload {
  decision?: unknown;
  note?: unknown;
}

function isDecision(
  value:
    unknown,
): value is
  TeachingDocumentReviewDecision {
  return (
    value ===
      'approved' ||
    value ===
      'returned'
  );
}

export async function POST(
  request:
    Request,
  {
    params,
  }: {
    params:
      Promise<{
        documentId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    documentId,
  } =
    await params;

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | ReviewPayload
        | null;

  if (
    !payload ||
    !isDecision(
      payload.decision,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Choose approve or return.',
      },
      {
        status:
          400,
      },
    );
  }

  const note =
    typeof payload.note ===
      'string'
      ? payload.note.trim()
      : '';

  if (
    payload.decision ===
      'returned' &&
    !note
  ) {
    return NextResponse.json(
      {
        message:
          'Add a correction note before returning the document.',
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
  } =
    await supabase.rpc(
      'review_teaching_document',
      {
        target_document_id:
          documentId,
        target_decision:
          payload.decision,
        target_note:
          note ||
          null,
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
    review:
      data,
  });
}
