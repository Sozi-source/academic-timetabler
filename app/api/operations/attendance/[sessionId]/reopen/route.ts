import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

export async function POST(
  _request:
    Request,
  {
    params,
  }: {
    params:
      Promise<{
        sessionId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    sessionId,
  } =
    await params;

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.rpc(
      'reopen_class_attendance_session',
      {
        target_class_session_id:
          sessionId,
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
  });
}
