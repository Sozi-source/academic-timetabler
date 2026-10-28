import {
  trainerCanAccessAssessment,
} from '@/features/staff-assessment/authorization';

import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  loadAssessmentMarkbookBundle,
} from '@/features/assessment/markbook-bundle';
import {
  assessmentMarkbookTemplateVersion,
  generateAssessmentMarkbook,
} from '@/features/assessment/markbook-generator';
import {
  createClient,
} from '@/lib/supabase/server';

export const runtime =
  'nodejs';

const workbookMimeType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

function safeFilenameBase(
  value: string,
): string {
  const cleaned =
    value
      .replace(
        /[<>:"/\\|?*\u0000-\u001F]/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');

  return (
    cleaned ||
    'Markbook'
  );
}

export async function POST(
  request: Request,
  {
    params,
  }: RouteContext,
) {
  await requireTrainerAccess();

  const {
    assessmentId,
  } = await params;

  const url = new URL(request.url);
  const requestedType = url.searchParams.get('type') as 'cat' | 'final' | null;

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

  // Check event submission status to ensure marksheet can only be downloaded after submission
  const { data: eventStatus } = await supabase
    .from('assessment_events')
    .select('cat_marks_finalized_at, exam_marks_finalized_at, marks_submitted_at')
    .eq('id', targetAssessmentId)
    .maybeSingle();

  const isCatSubmitted = Boolean(eventStatus?.cat_marks_finalized_at);
  const isFinalSubmitted = Boolean(
    eventStatus?.exam_marks_finalized_at || eventStatus?.marks_submitted_at,
  );

  let resolvedType: 'cat' | 'final';
  if (requestedType === 'cat') {
    if (!isCatSubmitted) {
      return NextResponse.json(
        { message: 'CAT marks must be submitted before downloading the CAT marksheet.' },
        { status: 400 },
      );
    }
    resolvedType = 'cat';
  } else if (requestedType === 'final') {
    if (!isFinalSubmitted) {
      return NextResponse.json(
        { message: 'Final marks must be submitted before downloading the Final marksheet.' },
        { status: 400 },
      );
    }
    resolvedType = 'final';
  } else {
    // Auto-detect based on submission state
    if (isFinalSubmitted) {
      resolvedType = 'final';
    } else if (isCatSubmitted) {
      resolvedType = 'cat';
    } else {
      return NextResponse.json(
        { message: 'Marksheet download is available after submitting CAT marks or final marks.' },
        { status: 400 },
      );
    }
  }

  // Attempt to lock/ensure bundle without blocking download
  if (!targetAssessmentId.startsWith('alloc-')) {
    await supabase.rpc(
      'lock_assessment_markbook_bundle',
      {
        target_assessment_id:
          targetAssessmentId,
      },
    );
  }

  const generationId =
    randomUUID();

  const generatedAt =
    new Date();

  try {
    const bundle =
      await loadAssessmentMarkbookBundle({
        rootAssessmentId:
          targetAssessmentId,
        generationId,
        generatedAt,
      });

    bundle.marksheetType = resolvedType;

    const workbook =
      await generateAssessmentMarkbook(
        bundle,
        { marksheetType: resolvedType },
      );

    const filename = `${safeFilenameBase(bundle.unit.name)} - ${resolvedType === 'cat' ? 'CAT Marksheet' : 'Final Marksheet'}.xlsx`;

    const sha256 =
      createHash(
        'sha256',
      )
        .update(
          workbook,
        )
        .digest(
          'hex',
        );

    const cohortCount =
      bundle.cohorts.length;

    const studentCount =
      bundle.cohorts.reduce(
        (
          total,
          cohort,
        ) =>
          total +
          cohort.students.length,
        0,
      );

    const absentCount =
      bundle.cohorts.reduce(
        (
          total,
          cohort,
        ) =>
          total +
          cohort.students.filter(
            (student) =>
              student.attendanceStatus ===
              'absent',
          ).length,
        0,
      );

    const {
      error: auditError,
    } = await supabase.rpc(
      'record_assessment_markbook_generation',
      {
        target_generation_id:
          generationId,
        target_assessment_id:
          assessmentId,
        target_template_version:
          assessmentMarkbookTemplateVersion,
        target_filename:
          filename,
        target_sha256:
          sha256,
        target_cohort_count:
          cohortCount,
        target_student_count:
          studentCount,
        target_absent_count:
          absentCount,
      },
    );

    if (auditError) {
      throw new Error(
        `Markbook audit could not be recorded: ${auditError.message}`,
      );
    }

    const asciiFallback =
      filename.replace(
        /[^\x20-\x7E]/g,
        '',
      );

    return new NextResponse(
      new Uint8Array(
        workbook,
      ),
      {
        status: 200,
        headers: {
          'Content-Type':
            workbookMimeType,
          'Content-Disposition':
            `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control':
            'private, no-store, max-age=0',
          'X-Content-Type-Options':
            'nosniff',
          'X-Markbook-Generation-Id':
            generationId,
          'X-Markbook-Template-Version':
            assessmentMarkbookTemplateVersion,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof
          Error
            ? error.message
            : 'Markbook could not be generated.',
      },
      {
        status: 409,
      },
    );
  }
}
