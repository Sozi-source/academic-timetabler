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
import {
  createAdminClient,
} from '@/lib/supabase/admin';

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
  const admin = createAdminClient();

  let targetAssessmentId = assessmentId;
  if (targetAssessmentId.startsWith('alloc-')) {
    const allocId = targetAssessmentId.replace('alloc-', '');
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

  const component = typeof requestPayload?.component === 'string' ? requestPayload.component : 'all';

  if (!Array.isArray(requestPayload?.entries) || requestPayload.entries.length === 0) {
    return NextResponse.json({ message: 'Provide mark entries to submit.' }, { status: 400 });
  }

  if (['assignment', 'presentation', 'rat'].includes(component)) {
    return NextResponse.json({
      message: 'Assignment, Presentation, and RAT marks are saved as drafts and submitted together with final marks at the end of the semester.',
    }, { status: 400 });
  }

  const componentEntries = requestPayload.entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || !('studentId' in entry) || typeof entry.studentId !== 'string') return [];
    const row = entry as Record<string, unknown>;
    return [{
      student_id: row.studentId,
      assignment: typeof row.assignment === 'number' ? row.assignment : null,
      presentation: typeof row.presentation === 'number' ? row.presentation : null,
      rat: typeof row.rat === 'number' ? row.rat : null,
      cat: typeof row.cat === 'number' ? row.cat : null,
      exam: typeof row.exam === 'number' ? row.exam : null,
      attendance_status: row.attendanceStatus === 'absent' ? 'absent' : 'expected',
    }];
  });

  if (componentEntries.length !== requestPayload.entries.length) {
    return NextResponse.json({ message: 'Every row must identify a student.' }, { status: 400 });
  }

  if (component === 'cat') {
    // Milestone 1: CAT marks submission
    const missingCat = componentEntries.filter((e) => e.cat === null).length;
    if (missingCat > 0) {
      return NextResponse.json({
        message: `Cannot submit CAT: ${missingCat} student(s) are missing CAT marks.`,
      }, { status: 422 });
    }

    const { data: submission, error: componentError } = await supabase.rpc('save_assessment_online_component_marks', {
      target_assessment_id: targetAssessmentId,
      target_component: 'cat',
      target_entries: componentEntries.map(({ attendance_status: _a, ...e }) => e),
      submit_component: true,
    });
    if (componentError) {
      return NextResponse.json({ message: componentError.message }, { status: componentError.code === '42501' ? 403 : 409 });
    }
    return NextResponse.json({ success: true, submission, message: 'CAT marks submitted successfully.' });
  }

  // Milestone 2: Final marks submission ('all' or 'exam')
  // Prepare final entries: students with null exam marks are confirmed as absent;
  // unsubmitted coursework (assignment, presentation, rat, cat) automatically defaults to 0.
  const finalEntries = componentEntries.map((e) => {
    const isAbsent = e.attendance_status === 'absent' || e.exam === null;
    return {
      student_id: e.student_id,
      assignment: typeof e.assignment === 'number' ? e.assignment : 0,
      presentation: typeof e.presentation === 'number' ? e.presentation : 0,
      rat: typeof e.rat === 'number' ? e.rat : 0,
      cat: typeof e.cat === 'number' ? e.cat : 0,
      exam: isAbsent ? null : e.exam,
      attendance_status: isAbsent ? ('absent' as const) : ('expected' as const),
    };
  });

  const absentStudentIds = finalEntries
    .filter((e) => e.attendance_status === 'absent')
    .map((e) => e.student_id);
  const presentStudentIds = finalEntries
    .filter((e) => e.attendance_status !== 'absent')
    .map((e) => e.student_id);

  if (absentStudentIds.length > 0) {
    await admin
      .from('assessment_roster')
      .update({ pre_assessment_status: 'absent' })
      .eq('assessment_id', targetAssessmentId)
      .in('student_id', absentStudentIds);

    await admin
      .from('assessment_population')
      .update({ attendance_status: 'absent' })
      .eq('assessment_event_id', targetAssessmentId)
      .in('student_id', absentStudentIds);
  }

  if (presentStudentIds.length > 0) {
    await admin
      .from('assessment_roster')
      .update({ pre_assessment_status: 'expected' })
      .eq('assessment_id', targetAssessmentId)
      .in('student_id', presentStudentIds);

    await admin
      .from('assessment_population')
      .update({ attendance_status: 'expected' })
      .eq('assessment_event_id', targetAssessmentId)
      .in('student_id', presentStudentIds);
  }

  // 1. Save all drafts with prepared marks
  const { error: saveError } = await supabase.rpc('save_assessment_online_marks', {
    target_assessment_id: targetAssessmentId,
    target_entries: finalEntries.map(({ attendance_status: _a, ...e }) => e),
  });
  if (saveError) {
    return NextResponse.json({ message: saveError.message }, { status: 409 });
  }

  // 2. Insert component submission records for all components
  const { data: rosterCohorts } = await admin
    .from('assessment_roster')
    .select('cohort_id')
    .eq('assessment_id', targetAssessmentId);

  const cohortIds = [...new Set((rosterCohorts ?? []).map((r) => r.cohort_id))];
  const allComponents = ['assignment', 'presentation', 'rat', 'cat', 'exam'] as const;

  for (const comp of allComponents) {
    for (const cId of cohortIds.length > 0 ? cohortIds : [null]) {
      await admin
        .from('assessment_mark_component_submissions')
        .upsert({
          assessment_id: targetAssessmentId,
          cohort_id: cId,
          component_key: comp,
        }, {
          onConflict: 'assessment_id,coalesce(cohort_id, \'00000000-0000-0000-0000-000000000000\'::uuid),component_key',
        });
    }
  }

  // 3. Finalize results in official assessment_results
  const { data: finalSubmission, error: finalError } = await supabase.rpc(
    'submit_assessment_online_marks',
    { target_assessment_id: targetAssessmentId },
  );

  if (finalError) {
    return NextResponse.json({
      message: finalError.message,
    }, { status: finalError.code === '42501' ? 403 : 409 });
  }

  return NextResponse.json({
    success: true,
    final: true,
    submission: finalSubmission,
    message: 'Final marks submitted and markbook finalized successfully.',
  });
}
