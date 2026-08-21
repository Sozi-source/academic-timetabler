import {
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
  generateAssessmentSigningSheet,
} from '@/features/assessment/signing-sheet-generator';
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
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()
      .replace(
        /[. ]+$/g,
        '',
      );

  return (
    cleaned ||
    'Signing Sheet'
  );
}

export async function POST(
  _request: Request,
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

  try {
    const generatedAt =
      new Date();

    const bundle =
      await loadAssessmentMarkbookBundle({
        rootAssessmentId:
          assessmentId,
        generationId:
          randomUUID(),
        generatedAt,
      });

    const workbook =
      await generateAssessmentSigningSheet(
        bundle,
      );

    const typeLabel =
      bundle.assessmentType ===
      'exam'
        ? 'Exam'
        : 'CAT';

    const filename =
      `${safeFilenameBase(
        bundle.unit.name,
      )} - ${typeLabel} Signing Sheet.xlsx`;

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
            : 'Signing sheet could not be generated.',
      },
      {
        status: 409,
      },
    );
  }
}
