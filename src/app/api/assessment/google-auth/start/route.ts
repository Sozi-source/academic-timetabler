import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { buildGoogleAuthorizationUrl } from '@/features/assessment/google-oauth';
import { requireHodAccess } from '@/features/auth/authorization';

export async function GET(request: Request) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department before connecting Google.' }, { status: 409 });
  }

  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get('returnTo') ?? '/assessment/marks';
  if (!/^\/assessment\/marks\/[0-9a-f-]+$/i.test(returnTo)) {
    return NextResponse.json({ message: 'Invalid return path for Google authorization.' }, { status: 400 });
  }

  try {
    const state = randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state));
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 600,
    };
    response.cookies.set('google_oauth_state', state, cookieOptions);
    response.cookies.set('google_oauth_return_to', returnTo, cookieOptions);
    response.cookies.set('google_oauth_department', profile.activeDepartmentId, cookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not start Google authorization.' }, { status: 503 });
  }
}
