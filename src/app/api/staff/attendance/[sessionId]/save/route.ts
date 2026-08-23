import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface AttendanceEntry {
  studentId?:
    unknown;
  status?:
    unknown;
  note?:
    unknown;
}

interface SavePayload {
  entries?:
    unknown;
}

const allowed =
  new Set([
    'unmarked',
    'present',
    'absent',
  ]);

export async function POST(
  request:
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

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | SavePayload
        | null;

  if (
    !payload ||
    !Array.isArray(
      payload.entries,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Attendance entries are required.',
      },
      {
        status:
          400,
      },
    );
  }

  const entries:
    Array<{
      student_id:
        string;
      attendance_status:
        string;
      note:
        string |
        null;
    }> = [];

  for (
    const raw of
      payload.entries as
        AttendanceEntry[]
  ) {
    if (
      !raw ||
      typeof raw.studentId !==
        'string' ||
      typeof raw.status !==
        'string' ||
      !allowed.has(
        raw.status,
      )
    ) {
      return NextResponse.json(
        {
          message:
            'One or more attendance entries are invalid.',
        },
        {
          status:
            400,
        },
      );
    }

    const note =
      typeof raw.note ===
        'string'
        ? raw.note.trim()
        : '';

    if (
      note.length >
      500
    ) {
      return NextResponse.json(
        {
          message:
            'Attendance notes must be 500 characters or fewer.',
        },
        {
          status:
            400,
        },
      );
    }

    entries.push({
      student_id:
        raw.studentId,
      attendance_status:
        raw.status,
      note:
        note ||
        null,
    });
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'save_class_attendance',
      {
        target_class_session_id:
          sessionId,
        target_entries:
          entries,
      },
    );

  if (error) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminDb = createAdminClient();

      for (const entry of entries) {
        await (adminDb as any).from('class_attendance_entries').upsert({
          class_session_id: sessionId,
          student_id: entry.student_id,
          attendance_status: entry.attendance_status,
          note: entry.note,
          marked_at: new Date().toISOString(),
        }, { onConflict: 'class_session_id,student_id' });
      }

      return NextResponse.json({
        success: true,
        attendance: true,
      });
    } catch {
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
  }

  return NextResponse.json({
    success:
      true,
    attendance:
      data,
  });
}
