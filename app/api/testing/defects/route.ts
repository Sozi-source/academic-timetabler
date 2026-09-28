import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface CreatePayload {
  title?: unknown;
  description?: unknown;
  severity?: unknown;
  runId?: unknown;
  caseKey?: unknown;
}

const severities =
  new Set([
    'critical',
    'high',
    'medium',
    'low',
  ]);

export async function POST(
  request: Request,
) {
  await requireHodAccess();

  const payload =
    await request
      .json()
      .catch(() => null) as CreatePayload | null;

  const title =
    typeof payload?.title === 'string'
      ? payload.title.trim()
      : '';

  const description =
    typeof payload?.description === 'string'
      ? payload.description.trim()
      : '';

  const severity =
    typeof payload?.severity === 'string'
      ? payload.severity
      : '';

  const runId =
    typeof payload?.runId === 'string' && payload.runId
      ? payload.runId
      : null;

  const caseKey =
    typeof payload?.caseKey === 'string' && payload.caseKey
      ? payload.caseKey
      : null;

  if (
    title.length < 3 ||
    title.length > 180 ||
    description.length < 3 ||
    description.length > 4000 ||
    !severities.has(severity)
  ) {
    return NextResponse.json(
      {
        message:
          'Enter a valid title, description and severity.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'create_release_test_defect',
    {
      target_title: title,
      target_description: description,
      target_severity: severity,
      target_run_id: runId,
      target_case_key: caseKey,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status:
          error.code === '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    defectId: data,
  });
}
