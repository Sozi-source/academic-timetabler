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
  validateAssessmentMarkbook,
} from '@/features/assessment/markbook-validator';

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

    const result =
      await validateAssessmentMarkbook(
        buffer,
        assessmentId,
        rule?.maximumMark ??
          null,
      );

    return NextResponse.json({
      valid:
        result.valid,
      summary: {
        totalRows:
          result.totalRows,
        numericMarks:
          result.numericMarks,
        absences:
          result.absences,
        missingMarks:
          result.missingMarks,
        issueCount:
          result.issues.length,
      },
      metadata: {
        templateVersion:
          result.templateVersion,
        generationId:
          result.generationId,
        assessmentType:
          result.assessmentType,
        academicPeriodId:
          result.academicPeriodId,
        unitId:
          result.unitId,
      },
      issues:
        result.issues.slice(
          0,
          100,
        ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof
          Error
            ? error.message
            : 'Workbook could not be read.',
      },
      {
        status: 422,
      },
    );
  }
}
