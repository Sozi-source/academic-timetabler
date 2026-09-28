import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface DeploymentPayload {
  environment?: unknown;
  versionLabel?: unknown;
  note?: unknown;
}

const environments =
  new Set([
    'pilot',
    'production',
  ]);

export async function POST(
  request: Request,
) {
  await requireHodAccess();

  const payload =
    await request
      .json()
      .catch(() => null) as DeploymentPayload | null;

  const environment =
    typeof payload?.environment === 'string'
      ? payload.environment
      : '';

  const versionLabel =
    typeof payload?.versionLabel === 'string'
      ? payload.versionLabel.trim()
      : '';

  const note =
    typeof payload?.note === 'string'
      ? payload.note.trim()
      : '';

  if (
    !environments.has(environment) ||
    versionLabel.length < 3 ||
    versionLabel.length > 80 ||
    note.length > 2000
  ) {
    return NextResponse.json(
      {
        message: 'Enter a valid environment and version label.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'record_release_deployment',
    {
      target_environment: environment,
      target_version_label: versionLabel,
      target_signoff_id: null,
      target_note: note || null,
    },
  );

  if (error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: error.code === '42501' ? 403 : 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    deploymentId: data,
  });
}
