import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
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
  await requireTrainerAccess();

  const {
    sessionId,
  } =
    await params;

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'complete_class_attendance_session',
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
    attendance:
      data,
  });
}
