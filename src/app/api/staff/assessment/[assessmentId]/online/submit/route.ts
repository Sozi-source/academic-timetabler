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

  let targetAssessmentId = assessmentId;
  if (targetAssessmentId.startsWith('alloc-')) {
    const allocId = targetAssessmentId.replace('alloc-', '');
    const { data: alloc } = await supabase
      .from('teaching_allocations')
      .select('academic_period_id, unit_id')
      .eq('id', allocId)
      .maybeSingle();

    if (alloc) {
      const { data: eventData } = await supabase
        .from('assessment_events')
        .select('id')
        .eq('academic_period_id', alloc.academic_period_id)
        .eq('unit_id', alloc.unit_id)
        .eq('assessment_type', 'exam')
        .maybeSingle();

      if (eventData?.id) {
        targetAssessmentId = eventData.id;
      } else {
        const { data: provisionedId } = await supabase.rpc(
          'ensure_unit_markbook_ready',
          {
            p_academic_period_id: alloc.academic_period_id,
            p_unit_id: alloc.unit_id,
          },
        );
        if (provisionedId) {
          targetAssessmentId = provisionedId as string;
        }
      }
    }
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetAssessmentId);
  if (!isUUID) {
    return NextResponse.json(
      { message: 'Unable to identify unit assessment event.' },
      { status: 400 },
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'submit_assessment_online_marks',
      {
        target_assessment_id:
          targetAssessmentId,
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
          '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    submission:
      data,
  });
}
