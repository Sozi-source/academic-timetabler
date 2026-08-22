import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface IncidentPayload {
  environment?: unknown;
  deploymentId?: unknown;
  severity?: unknown;
  title?: unknown;
  description?: unknown;
}

const environments = new Set(['pilot', 'production']);
const severities = new Set(['critical', 'high', 'medium', 'low']);

export async function POST(
  request: Request,
) {
  await requireHodAccess();

  const payload =
    await request
      .json()
      .catch(() => null) as IncidentPayload | null;

  const environment =
    typeof payload?.environment === 'string'
      ? payload.environment
      : '';

  const severity =
    typeof payload?.severity === 'string'
      ? payload.severity
      : '';

  const deploymentId =
    typeof payload?.deploymentId === 'string' && payload.deploymentId
      ? payload.deploymentId
      : null;

  const title =
    typeof payload?.title === 'string'
      ? payload.title.trim()
      : '';

  const description =
    typeof payload?.description === 'string'
      ? payload.description.trim()
      : '';

  if (
    !environments.has(environment) ||
    !severities.has(severity) ||
    title.length < 3 ||
    title.length > 180 ||
    description.length < 3 ||
    description.length > 4000
  ) {
    return NextResponse.json(
      {
        message: 'Enter a valid environment, severity, title and description.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'create_production_incident',
    {
      target_environment: environment,
      target_title: title,
      target_description: description,
      target_severity: severity,
      target_deployment_id: deploymentId,
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
    incidentId: data,
  });
}
