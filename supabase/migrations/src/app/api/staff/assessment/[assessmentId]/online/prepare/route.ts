import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  trainerCanAccessAssessment,
} from '@/features/staff-assessment/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface RouteContext {
  params:
    Promise<{
      assessmentId:
        string;
    }>;
}

export async function POST(
  _request:
    Request,
  {
    params,
  }: RouteContext,
) {
  await requireTrainerAccess();

  const {
    assessmentId,
  } =
    await params;

  if (
    !await trainerCanAccessAssessment(
      assessmentId,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'This assessment is outside your Teaching Allocations.',
      },
      {
        status:
          403,
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
      'lock_assessment_markbook_bundle',
      {
        target_assessment_id:
          assessmentId,
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
          409,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    preparation:
      data,
  });
}
