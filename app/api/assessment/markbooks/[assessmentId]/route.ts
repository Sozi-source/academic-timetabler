import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  await requireHodAccess();

  const { assessmentId } = await params;

  if (!assessmentId) {
    return NextResponse.json(
      {
        message: 'Markbook ID is required.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    'delete_generated_markbook',
    {
      target_assessment_id: assessmentId,
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
