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
      .catch(() => null);

  const studentId =
    typeof body?.studentId ===
      'string'
      ? body.studentId
      : '';

  const absent =
    body?.absent === true;

  if (
    !assessmentId ||
    !studentId
  ) {
    return NextResponse.json(
      {
        message:
          'Assessment and student are required.',
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
    'set_assessment_population_absence',
    {
      target_assessment_id:
        assessmentId,
      target_student_id:
        studentId,
      target_absent:
        absent,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    attendance: data,
  });
}
