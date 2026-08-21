import {
  randomInt,
} from 'node:crypto';

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

export async function POST(
  _request:
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

  const pin =
    String(
      randomInt(
        100000,
        1000000,
      ),
    );

  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    error,
  } =
    await supabase.rpc(
      'set_student_portal_pin',
      {
        target_student_id:
          studentId,
        plain_pin:
          pin,
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

  return NextResponse.json(
    {
      success:
        true,
      pin,
    },
    {
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}
