import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface RollbackPayload {
  reason?: unknown;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      deploymentId: string;
    }>;
  },
) {
  await requireHodAccess();

  const { deploymentId } = await params;
  const payload =
    await request
      .json()
      .catch(() => null) as RollbackPayload | null;

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
        message: 'Enter a rollback reason.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    'rollback_release_deployment',
    {
      target_deployment_id: deploymentId,
      target_reason: reason,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: error.code === '42501' ? 403 : 409,
      },
    );
  }

  return NextResponse.json({ success: true });
}
