import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface SignoffPayload {
  verificationRef?: unknown;
  note?: unknown;
}

export async function POST(
  request: Request,
) {
  await requireHodAccess();

  const payload =
    await request
      .json()
      .catch(() => null) as SignoffPayload | null;

  const verificationRef =
    typeof payload?.verificationRef === 'string'
      ? payload.verificationRef.trim()
      : '';

  const note =
    typeof payload?.note === 'string'
      ? payload.note.trim()
      : '';

  if (
    verificationRef.length < 8 ||
    verificationRef.length > 200 ||
    note.length > 2000
  ) {
    return NextResponse.json(
      {
        message:
          'Enter a valid local verification ID.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'approve_release_signoff',
    {
      target_verification_ref: verificationRef,
      target_note: note || null,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status:
          error.code === '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    signoffId: data,
  });
}
