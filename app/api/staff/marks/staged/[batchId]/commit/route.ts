import {
  trainerCanAccessBatch,
} from '@/features/staff-assessment/authorization';

import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    batchId: string;
  }>;
}

export async function POST(
  _request: Request,
  {
    params,
  }: RouteContext,
) {
  await requireTrainerAccess();

  const {
    batchId,
  } = await params;

  const trainerAllowed =
    await trainerCanAccessBatch(
      batchId,
    );

  if (!trainerAllowed) {
    return NextResponse.json(
      {
        message:
          'This staged markbook is outside your Teaching Allocations.',
      },
      {
        status: 403,
      },
    );
  }

  if (!batchId) {
    return NextResponse.json(
      {
        message:
          'Staged markbook batch is required.',
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
  } =
    await supabase.rpc(
      'commit_assessment_markbook_import',
      {
        target_batch_id:
          batchId,
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
          '23505'
            ? 409
            : 422,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    result:
      data,
  });
}
