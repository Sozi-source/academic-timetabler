import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface RevokePayload {
  reason?: unknown;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      signoffId: string;
    }>;
  },
) {
  await requireHodAccess();

  const {
    signoffId,
  } = await params;

  const payload =
    await request
      .json()
      .catch(() => null) as RevokePayload | null;

  const reason =
    typeof payload?.reason === 'string'
      ? payload.reason.trim()
      : '';

  if (
    reason.length < 3 ||
    reason.length > 2000
  ) {
    return NextResponse.json(
      {
        message: 'A revocation reason is required.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } = await supabase.rpc(
    'revoke_release_signoff',
    {
      target_signoff_id: signoffId,
      target_reason: reason,
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
  });
}
