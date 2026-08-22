import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface UpdatePayload {
  status?: unknown;
  resolutionNote?: unknown;
}

const statuses =
  new Set([
    'open',
    'investigating',
    'resolved',
    'closed',
  ]);

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      incidentId: string;
    }>;
  },
) {
  await requireHodAccess();

  const { incidentId } = await params;
  const payload =
    await request
      .json()
      .catch(() => null) as UpdatePayload | null;

  const status =
    typeof payload?.status === 'string'
      ? payload.status
      : '';

  const resolutionNote =
    typeof payload?.resolutionNote === 'string'
      ? payload.resolutionNote.trim()
      : '';

  if (
    !statuses.has(status) ||
    resolutionNote.length > 4000
  ) {
    return NextResponse.json(
      {
        message: 'Choose a valid incident status.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    'update_production_incident_status',
    {
      target_incident_id: incidentId,
      target_status: status,
      target_resolution_note: resolutionNote || null,
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

  return NextResponse.json({ success: true });
}
