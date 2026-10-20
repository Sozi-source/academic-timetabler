import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { inviteId } = await params;
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('assessment_trainer_mark_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('department_id', profile.activeDepartmentId)
    .is('revoked_at', null)
    .is('submitted_at', null)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) return NextResponse.json({ message: 'Could not revoke this trainer invitation.' }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Invitation is already closed or unavailable.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
