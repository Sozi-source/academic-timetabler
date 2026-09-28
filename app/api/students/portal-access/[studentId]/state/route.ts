import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface StatePayload {
  active?: unknown;
}

export async function POST(
  request:
    Request,
  {
    params,
  }: {
    params:
      Promise<{
        studentId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    studentId,
  } =
    await params;

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | StatePayload
        | null;

  if (
    !payload ||
    typeof payload.active !==
      'boolean'
  ) {
    return NextResponse.json(
      {
        message:
          'Choose an access state.',
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
    error,
  } =
    await supabase.rpc(
      'set_student_portal_access_state',
      {
        target_student_id:
          studentId,
        target_is_active:
          payload.active,
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
    active:
      payload.active,
  });
}
