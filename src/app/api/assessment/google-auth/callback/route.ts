import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { saveGoogleAuthorization } from '@/features/assessment/google-oauth';
import { requireHodAccess } from '@/features/auth/authorization';

export async function GET(request: Request) {
  const profile = await requireHodAccess();
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('google_oauth_state')?.value;
  const returnToCookie = cookieStore.get('google_oauth_return_to')?.value;
  const expectedDepartmentId = cookieStore.get('google_oauth_department')?.value;
  const returnTo = returnToCookie && /^\/assessment\/marks\/[0-9a-f-]+$/i.test(returnToCookie)
    ? returnToCookie
    : '/assessment/marks';
  const destination = new URL(returnTo, url.origin);
  const clearOAuthCookies = (response: NextResponse) => {
    response.cookies.delete('google_oauth_state');
    response.cookies.delete('google_oauth_return_to');
    response.cookies.delete('google_oauth_department');
    return response;
  };
  const fail = () => {
    destination.searchParams.set('googleConnection', 'error');
    return clearOAuthCookies(NextResponse.redirect(destination));
  };

  if (!expectedState || url.searchParams.get('state') !== expectedState) return fail();
  const code = url.searchParams.get('code');
  if (
    url.searchParams.has('error') || !code || !profile.activeDepartmentId ||
    profile.activeDepartmentId !== expectedDepartmentId
  ) return fail();

  try {
    await saveGoogleAuthorization({
      code,
      departmentId: profile.activeDepartmentId,
      profileId: profile.id,
    });
    destination.searchParams.set('googleConnection', 'connected');
    return clearOAuthCookies(NextResponse.redirect(destination));
  } catch {
    return fail();
  }
}
