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
    error: lockError,
  } = await supabase.rpc(
    'lock_assessment_markbook_bundle',
    {
      target_assessment_id:
        assessmentId,
    },
  );

  if (lockError) {
    return NextResponse.json(
      {
        message:
          lockError.message,
      },
      {
        status: 409,
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
          assessmentId,
        generationId,
        generatedAt,
      });

    const workbook =
      await generateAssessmentMarkbook(
        bundle,
      );

    const filename =
      `${safeFilenameBase(
        bundle.unit.name,
      )}.xlsx`;

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
