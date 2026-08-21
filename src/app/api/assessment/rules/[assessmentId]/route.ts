import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  validateAssessmentRule,
} from '@/features/assessment/assessment-rule-domain';
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

  const maximumMark =
    typeof body
      ?.maximumMark ===
      'number'
      ? body.maximumMark
      : null;

  const passMark =
    typeof body
      ?.passMark ===
      'number'
      ? body.passMark
      : null;

  const validationError =
    validateAssessmentRule({
      maximumMark,
      passMark,
    });

  if (
    validationError
  ) {
    return NextResponse.json(
      {
        message:
          validationError,
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
    'set_assessment_rule',
    {
      target_assessment_id:
        assessmentId,
      target_maximum_mark:
        maximumMark,
      target_pass_mark:
        passMark,
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
    rule: data,
  });
}
