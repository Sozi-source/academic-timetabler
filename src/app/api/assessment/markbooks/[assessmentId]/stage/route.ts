import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  getAssessmentRuleForAssessment,
} from '@/features/assessment/assessment-rule-query';
import {
  buildAssessmentMarkbookStagePayload,
} from '@/features/assessment/markbook-staging';
import {
  validateAssessmentMarkbook,
} from '@/features/assessment/markbook-validator';
import {
  createClient,
} from '@/lib/supabase/server';

export const runtime =
  'nodejs';

const maximumWorkbookBytes =
  10 *
  1024 *
  1024;

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: RouteContext,
) {
  await requireHodAccess();

  const {
    assessmentId,
  } = await params;

  const formData =
    await request.formData();

  const file =
    formData.get(
      'file',
    );

  if (
    !(file instanceof File)
  ) {
    return NextResponse.json(
      {
        message:
          'Choose an Excel workbook.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith(
        '.xlsx',
      )
  ) {
    return NextResponse.json(
      {
        message:
          'Only .xlsx markbooks are accepted.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    file.size >
    maximumWorkbookBytes
  ) {
    return NextResponse.json(
      {
        message:
          'The workbook is larger than 10 MB.',
      },
      {
        status: 413,
      },
    );
  }

  try {
    const buffer =
      Buffer.from(
        await file.arrayBuffer(),
      );

    const rule =
      await getAssessmentRuleForAssessment(
        assessmentId,
      );

    if (!rule) {
      return NextResponse.json(
        {
          message:
            'Configure the assessment maximum and pass mark before staging.',
        },
        {
          status: 409,
        },
      );
    }

    const validation =
      await validateAssessmentMarkbook(
        buffer,
        assessmentId,
        rule.maximumMark,
      );

    if (
      !validation.valid
    ) {
      return NextResponse.json(
        {
          message:
            'Workbook validation failed.',
          issues:
            validation.issues.slice(
              0,
              100,
            ),
          summary: {
            totalRows:
              validation.totalRows,
            numericMarks:
              validation.numericMarks,
            absences:
              validation.absences,
            missingMarks:
              validation.missingMarks,
            issueCount:
              validation.issues.length,
          },
        },
        {
          status: 422,
        },
      );
    }

    const sha256 =
      createHash(
        'sha256',
      )
        .update(
          buffer,
        )
        .digest(
          'hex',
        );

    const payload =
      buildAssessmentMarkbookStagePayload({
        validation,
        filename:
          file.name,
        sha256,
      });

    if (
      payload.rootAssessmentId !==
      assessmentId
    ) {
      return NextResponse.json(
        {
          message:
            'This workbook belongs to a different assessment.',
        },
        {
          status: 409,
        },
      );
    }

    const batchId =
      randomUUID();

    const supabase =
      await createClient();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'stage_assessment_markbook_import',
        {
          target_batch_id:
            batchId,
          target_root_assessment_id:
            payload.rootAssessmentId,
          target_generation_id:
            payload.generationId,
          target_template_version:
            payload.templateVersion,
          target_filename:
            payload.filename,
          target_sha256:
            payload.sha256,
          target_assessment_type:
            payload.assessmentType,
          target_academic_period_id:
            payload.academicPeriodId,
          target_unit_id:
            payload.unitId,
          target_validation_summary:
            payload.validationSummary,
          target_rows:
            payload.rows,
        },
      );

    if (error) {
      return NextResponse.json(
        {
          message:
            error.message,
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success:
        true,
      batchId:
        typeof data ===
        'string'
          ? data
          : batchId,
      summary:
        payload.validationSummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof
          Error
            ? error.message
            : 'Workbook could not be staged.',
      },
      {
        status: 422,
      },
    );
  }
}
