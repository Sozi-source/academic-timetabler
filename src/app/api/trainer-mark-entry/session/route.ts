import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getTrainerMarkInvite, loadTrainerMarkSession } from '@/features/assessment/trainer-mark-entry';

const inviteCookieName = 'trainer_mark_invite';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(inviteCookieName)?.value;
  if (!token) return NextResponse.json({ message: 'Open your invitation link to access this markbook.' }, { status: 401 });

  try {
    const invite = await getTrainerMarkInvite(token);
    if (!invite) return NextResponse.json({ message: 'This trainer link has expired or was revoked. Ask the HOD for a new link.' }, { status: 410 });
    const session = await loadTrainerMarkSession(invite);
    return NextResponse.json(session, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load the assigned markbook.' }, { status: 500 });
  }
}
