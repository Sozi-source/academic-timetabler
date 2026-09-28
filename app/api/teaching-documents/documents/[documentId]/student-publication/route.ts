import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface Payload {
  published?:
    unknown;
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
        | Payload
        | null;

  if (
    !payload ||
    typeof payload.published !==
      'boolean'
  ) {
    return NextResponse.json(
      {
        message:
          'Choose whether the document should be visible to students.',
      },
      {
        status:
          400,
      },
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'set_teaching_document_student_publication',
      {
        target_document_id:
          documentId,
        target_published:
          payload.published,
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
    publication:
      data,
  });
}
