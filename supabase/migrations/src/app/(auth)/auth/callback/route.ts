import {
  NextResponse,
  type NextRequest,
} from 'next/server';

import {
  canUsePostLoginPath,
  getHomePathForRole,
} from '@/features/auth/routing';
import type {
  AppRole,
} from '@/features/auth/types';
import {
  createClient,
} from '@/lib/supabase/server';

function safeNext(
  value: string | null,
): string | null {
  if (
    !value ||
    !value.startsWith(
      '/',
    ) ||
    value.startsWith(
      '//',
    )
  ) {
    return null;
  }

  return value;
}

export async function GET(
  request:
    NextRequest,
) {
  const code =
    request.nextUrl.searchParams.get(
      'code',
    );

  const requestedNext =
    safeNext(
      request.nextUrl.searchParams.get(
        'next',
      ),
    );

  if (!code) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      '/login';

    loginUrl.search =
      '';

    loginUrl.searchParams.set(
      'error',
      'invalid_callback',
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.auth
      .exchangeCodeForSession(
        code,
      );

  if (error) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      '/login';

    loginUrl.search =
      '';

    loginUrl.searchParams.set(
      'error',
      'auth_callback',
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  const {
    data: authData,
  } =
    await supabase.auth.getUser();

  if (
    !authData.user
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      '/login';

    loginUrl.search =
      '';

    return NextResponse.redirect(
      loginUrl,
    );
  }

  const {
    data: profile,
  } =
    await supabase
      .from(
        'profiles',
      )
      .select(
        'role, is_active',
      )
      .eq(
        'id',
        authData.user.id,
      )
      .maybeSingle();

  const role =
    profile?.role as
      AppRole |
      undefined;

  const destination =
    profile
      ?.is_active &&
    role
      ? (
          requestedNext &&
          canUsePostLoginPath(
            role,
            requestedNext,
          )
            ? requestedNext
            : getHomePathForRole(
                role,
              )
        )
      : '/unauthorized';

  const redirectUrl =
    request.nextUrl.clone();

  redirectUrl.pathname =
    destination;

  redirectUrl.search =
    '';

  return NextResponse.redirect(
    redirectUrl,
  );
}
