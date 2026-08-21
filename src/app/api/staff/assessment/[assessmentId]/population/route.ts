import {
  trainerCanAccessAssessment,
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
    assessmentId: string;
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
    assessmentId,
  } = await params;

  const trainerAllowed =
    await trainerCanAccessAssessment(
      assessmentId,
    );

  if (!trainerAllowed) {
    return NextResponse.json(
      {
        message:
          'This assessment is outside your Teaching Allocations.',
      },
      {
        status: 403,
      },
    );
  }

  if (!assessmentId) {
    return NextResponse.json(
      {
        message:
          'Assessment ID is required.',
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
    'generate_assessment_population_from_registrations',
    {
      target_assessment_id:
        assessmentId,
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
    population: data,
  });
}
