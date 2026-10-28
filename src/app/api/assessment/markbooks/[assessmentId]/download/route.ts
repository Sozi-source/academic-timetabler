import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
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
  await requireHodAccess();

  const {
    assessmentId,
  } = await params;

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

  const url = new URL(request.url);
  const requestedType = url.searchParams.get('type') as 'cat' | 'final' | null;

  const supabase =
    await createClient();

  const { data: eventGate } = await supabase
    .from('assessment_events')
    .select('marks_submitted_at, cat_marks_finalized_at, exam_marks_finalized_at, operational_workflow_status')
    .eq('id', assessmentId)
    .maybeSingle();

  const marksSubmitted = Boolean(eventGate?.marks_submitted_at || eventGate?.exam_marks_finalized_at);
  const catSubmitted = Boolean(eventGate?.cat_marks_finalized_at);
  const workflowStatus = eventGate?.operational_workflow_status ?? null;
  const isTerminal = ['submitted', 'finalised', 'archived'].includes(
    workflowStatus ?? '',
  );

  let resolvedType: 'cat' | 'final';
  if (requestedType === 'cat') {
    if (!catSubmitted) {
      return NextResponse.json(
        { message: 'CAT marks must be submitted before downloading the CAT marksheet.' },
        { status: 409 },
      );
    }
    resolvedType = 'cat';
  } else if (requestedType === 'final') {
    if (!marksSubmitted && !isTerminal) {
      return NextResponse.json(
        { message: 'Final marks must be submitted before downloading the Final marksheet.' },
        { status: 409 },
      );
    }
    resolvedType = 'final';
  } else {
    if (marksSubmitted || isTerminal) {
      resolvedType = 'final';
    } else if (catSubmitted) {
      resolvedType = 'cat';
    } else {
      return NextResponse.json(
        {
          message:
            'Marksheet cannot be generated yet. The trainer must submit CAT marks or final marks before downloading.',
        },
        { status: 409 },
      );
    }
  }

  // Attempt to lock/ensure bundle without blocking download
  await supabase.rpc(
    'lock_assessment_markbook_bundle',
    {
      target_assessment_id:
        assessmentId,
    },
  );

  const generationId =
    randomUUID();

  const generatedAt =
    new Date();

  try {
    const bundle =
      await loadAssessmentMarkbookBundle({
        rootAssessmentId:
          assessmentId,
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
          // Non-zero value means the DB roster was stale at generation time.
          // The HOD should close trainer entry (which triggers a roster re-sync)
          // to persist the missing students for subsequent downloads.
          'X-Markbook-Roster-Augmented':
            String(bundle.rosterAugmentedCount),
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
