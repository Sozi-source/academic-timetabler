import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface CreatePayload {
  scheduledSessionId?:
    unknown;
  sessionDate?:
    unknown;
}

export async function POST(
  request:
    Request,
) {
  await requireTrainerAccess();

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | CreatePayload
        | null;

  if (
    !payload ||
    typeof payload.scheduledSessionId !==
      'string' ||
    typeof payload.sessionDate !==
      'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      payload.sessionDate,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Choose a valid scheduled class and date.',
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
      'open_class_attendance_session',
      {
        target_scheduled_session_id:
          payload.scheduledSessionId,
        target_session_date:
          payload.sessionDate,
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
    classSessionId:
      data,
  });
}
