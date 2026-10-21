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
  request:
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
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: alloc } = await admin
      .from('teaching_allocations')
      .select('academic_period_id, unit_id')
      .eq('id', allocId)
      .maybeSingle();

    if (alloc) {
      const { data: eventData } = await admin
        .from('assessment_events')
        .select('id')
        .eq('academic_period_id', alloc.academic_period_id)
        .eq('unit_id', alloc.unit_id)
        .eq('assessment_type', 'exam')
        .maybeSingle();

      if (eventData?.id) {
        targetAssessmentId = eventData.id;
      } else {
        const { data: provisionedId } = await admin.rpc(
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

  const requestPayload = await request.json().catch(() => null) as {
    component?: unknown;
    entries?: unknown;
  } | null;
  if (requestPayload?.component !== undefined) {
    if (typeof requestPayload.component !== 'string' || !['assignment', 'presentation', 'rat', 'cat', 'exam'].includes(requestPayload.component) || !Array.isArray(requestPayload.entries)) {
      return NextResponse.json({ message: 'Choose a component and provide its marks.' }, { status: 400 });
    }
    const componentEntries = requestPayload.entries.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || !('studentId' in entry) || typeof entry.studentId !== 'string') return [];
      const row = entry as Record<string, unknown>;
      return [{
        student_id: row.studentId,
        assignment: row.assignment ?? null,
        presentation: row.presentation ?? null,
        rat: row.rat ?? null,
        cat: row.cat ?? null,
        exam: row.exam ?? null,
      }];
    });
    if (componentEntries.length !== requestPayload.entries.length) {
      return NextResponse.json({ message: 'Every row must identify a student.' }, { status: 400 });
    }
    const { data: submission, error: componentError } = await supabase.rpc('save_assessment_online_component_marks', {
      target_assessment_id: targetAssessmentId,
      target_component: requestPayload.component,
      target_entries: componentEntries,
      submit_component: true,
    });
    if (componentError) {
      return NextResponse.json({ message: componentError.message }, { status: componentError.code === '42501' ? 403 : 409 });
    }
    return NextResponse.json({ success: true, submission });
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
