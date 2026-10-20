import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTrainerMarkInvite, isTrainerMarkToken } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

const exchangeSchema = z.object({ token: z.string().refine(isTrainerMarkToken) });
const inviteCookieName = 'trainer_mark_invite';

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = exchangeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: 'This trainer link is invalid. Ask the HOD for a new link.' }, { status: 400 });
  }

  try {
    const invite = await getTrainerMarkInvite(parsed.data.token);
    if (!invite) {
      return NextResponse.json({ message: 'This trainer link has expired or was revoked. Ask the HOD for a new link.' }, { status: 410 });
    }

    const admin = createAdminClient();
    await admin.from('assessment_trainer_mark_invites')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', invite.id);

    const response = NextResponse.json({ success: true });
    const remainingSeconds = Math.max(1, Math.floor((Date.parse(invite.expires_at) - Date.now()) / 1000));
    response.cookies.set(inviteCookieName, parsed.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/trainer-mark-entry',
      maxAge: remainingSeconds,
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return NextResponse.json({ message: 'Could not verify this trainer link. Please try again.' }, { status: 500 });
  }
}
