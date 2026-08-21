import { NextRequest, NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    studentId: string;
  }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  await requireHodAccess();

  const { studentId } = await params;

  const body = await request
    .json()
    .catch(() => null);

  const academicPeriodId =
    typeof body?.academicPeriodId === 'string'
      ? body.academicPeriodId
      : '';

  if (!studentId || !academicPeriodId) {
    return NextResponse.json(
      {
        message:
          'Student and Academic Period are required.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    'undo_student_unit_registration',
    {
      target_student_id: studentId,
      target_academic_period_id:
        academicPeriodId,
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
  });
}
