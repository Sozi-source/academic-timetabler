import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getPublicEnvironment } from '@/lib/validation/environment';

export async function updateSession(request: NextRequest) {
  const environment = getPublicEnvironment();

  let response = NextResponse.next({
    request,
  });

  // Optimization 1: Bypass background prefetch requests entirely
  const isPrefetch =
    request.headers.get('x-middleware-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';

  if (isPrefetch) {
    return response;
  }

  // Optimization 2: Avoid network roundtrips if no Supabase session cookie is present
  const hasSessionCookie = request.cookies.getAll().some((cookie) =>
    cookie.name.includes('auth-token')
  );

  if (!hasSessionCookie) {
    return response;
  }

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  /*
   * This verifies the authentication token and refreshes
   * expired cookies when necessary.
   */
  await supabase.auth.getClaims();

  return response;
}