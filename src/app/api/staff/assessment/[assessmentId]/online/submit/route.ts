import { z } from 'zod';
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

const VALID_COMPONENTS = ['all', 'assignment', 'presentation', 'rat', 'cat', 'exam'] as const;
type MarkComponent = typeof VALID_COMPONENTS[number];

/** Server-side mark range bounds. Must mirror DB CHECK constraints. */
const MARK_BOUNDS: Record<'assignment' | 'presentation' | 'rat' | 'cat' | 'exam', [number, number]> = {
  assignment:   [0, 5],
  presentation: [0, 10],
  rat:          [0, 15],
  cat:          [0, 15],
  exam:         [0, 70],
};

const entrySchema = z.object({
  studentId: z.string().min(1),
  assignment: z.number().finite().nullable(),
  presentation: z.number().finite().nullable(),
  rat: z.number().finite().nullable(),
  cat: z.number().finite().nullable(),
  exam: z.number().finite().nullable(),
  attendanceStatus: z.enum(['expected', 'absent']).optional(),
});

const submitSchema = z.object({
  component: z.enum(VALID_COMPONENTS).default('all'),
  entries: z.array(entrySchema).min(1).max(2000),
});

function validateMarkBounds(
  entries: Array<z.infer<typeof entrySchema>>,
  component: MarkComponent,
): string | null {
  const fields = (component === 'all' || component === 'exam')
    ? (['assignment', 'presentation', 'rat', 'cat', 'exam'] as const)
    : [component] as Array<'assignment' | 'presentation' | 'rat' | 'cat' | 'exam'>;

  for (const entry of entries) {
    for (const field of fields) {
      const val = entry[field];
      if (val === null) continue;
      const [min, max] = MARK_BOUNDS[field];
      if (val < min || val > max) {
        return `${field} mark ${val} is out of range (${min}–${max}).`;
      }
    }
  }
  return null;
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

  // Validate and parse request body with Zod
  const rawBody = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstError?.message ?? 'Invalid submission payload.' },
      { status: 400 },
    );
  }

  const { component, entries } = parsed.data;

  if (['assignment', 'presentation', 'rat'].includes(component)) {
    return NextResponse.json({
      message: 'Assignment, Presentation, and RAT marks are saved continuously and submitted together with final marks at the end of the semester.',
    }, { status: 400 });
  }

  // Server-side mark range validation
  const boundsError = validateMarkBounds(entries, component);
  if (boundsError) {
    return NextResponse.json({ message: boundsError }, { status: 422 });
  }

  const componentEntries = entries.map((entry) => ({
    student_id: entry.studentId,
    assignment: entry.assignment,
    presentation: entry.presentation,
    rat: entry.rat,
    cat: entry.cat,
    exam: entry.exam,
    attendance_status: entry.attendanceStatus === 'absent' ? 'absent' : 'expected',
  }));

  if (component === 'cat') {
    // Milestone 1: CAT marks submission (midterm milestone)
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

  // 1. Save all drafts with prepared marks first (RLS-enforced via user client).
  const { error: saveError } = await supabase.rpc('save_assessment_online_marks', {
    target_assessment_id: targetAssessmentId,
    target_entries: finalEntries.map(({ attendance_status: _a, ...e }) => e),
  });
  if (saveError) {
    return NextResponse.json({ message: saveError.message }, { status: 409 });
  }

  // 2. Finalize results in official assessment_results (RLS-enforced).
  const { data: finalSubmission, error: finalError } = await supabase.rpc(
    'submit_assessment_online_marks',
    { target_assessment_id: targetAssessmentId },
  );

  if (finalError) {
    return NextResponse.json({
      message: finalError.message,
    }, { status: finalError.code === '42501' ? 403 : 409 });
  }

  // 3. Only after successful DB submission: sync attendance status in roster/population.
  //    This is best-effort — failures here do not roll back the submission.
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

  // 4. Insert component submission records for all components.
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

  return NextResponse.json({
    success: true,
    final: true,
    submission: finalSubmission,
    message: 'Final marks submitted and markbook finalized successfully.',
  });
}
