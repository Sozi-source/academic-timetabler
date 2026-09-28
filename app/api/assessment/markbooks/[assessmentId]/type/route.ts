import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: RouteContext,
) {
  await requireHodAccess();

  const {
    assessmentId,
  } = await params;

  const body =
    await request
      .json()
      .catch(
        () => null,
      );

  const assessmentType =
    body?.assessmentType ===
      'cat'
      ? 'cat'
      : body
          ?.assessmentType ===
        'exam'
        ? 'exam'
        : null;

  if (
    !assessmentId ||
    !assessmentType
  ) {
    return NextResponse.json(
      {
        message:
          'Choose CAT or Exam.',
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
    'set_operational_assessment_type',
    {
      target_assessment_id:
        assessmentId,
      target_assessment_type:
        assessmentType,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message:
          error.message,
      },
      {
        status: 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    assessment: data,
  });
}
